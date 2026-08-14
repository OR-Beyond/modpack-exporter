import React, { useEffect, useRef, useState } from 'react';
import {
  Settings, ChevronDown, LogOut, Github, LayoutDashboard, ScrollText, History, CircleDot,
} from 'lucide-react';
import type { GitHubUser } from '../../types';
import appIcon from '../../../assets/icon.png';
import WindowControls from '../WindowControls';

export type Page = 'home' | 'history' | 'issues' | 'settings' | 'logs';

interface Props {
  user: GitHubUser | null;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  /** When `user` is null, the Sign-in button calls this instead of navigating. */
  onSignIn?: () => void;
}

const navItems: { page: Page; label: string; icon: React.ReactNode }[] = [
  { page: 'home', label: 'Home', icon: <LayoutDashboard size={16} /> },
  { page: 'history', label: 'History', icon: <History size={16} /> },
  { page: 'issues', label: 'Issues', icon: <CircleDot size={16} /> },
  { page: 'logs', label: 'Logs', icon: <ScrollText size={16} /> },
  { page: 'settings', label: 'Settings', icon: <Settings size={16} /> },
];

export default function Header({ user, currentPage, onNavigate, onLogout, onSignIn }: Props) {
  const isMac = window.electron.platform === 'darwin';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuOpen]);

  const handleMenuLogout = () => {
    setMenuOpen(false);
    onLogout();
  };

  const openProfile = () => {
    if (user?.html_url) window.electron.app.openExternal(user.html_url);
    setMenuOpen(false);
  };

  return (
    <div
      className="flex items-center justify-between h-14 bg-background border-b border-line/6 flex-shrink-0 drag-region"
      style={{ minHeight: 56, paddingLeft: isMac ? 2 : 16, paddingRight: 20 }}
    >
      {isMac && <WindowControls />}

      {/* Left: logo + title + nav */}
      <div className="flex items-center gap-1 no-drag min-w-0">
        <span className="flex items-center gap-3 mr-4 flex-shrink-0">
          <img
            src={appIcon}
            alt="ORB"
            className="w-8 h-8 rounded-[10px] flex-shrink-0 object-cover"
          />
          <span className="font-semibold text-foreground text-[15px] tracking-tight whitespace-nowrap hidden sm:inline">
            ORB Modpack Exporter
          </span>
        </span>

        {/* Nav items */}
        <nav className="flex items-center gap-0.5">
          {navItems.map(item => (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-sm font-medium transition-colors whitespace-nowrap ${
                currentPage === item.page
                  ? 'bg-line/8 text-foreground'
                  : 'text-muted hover:bg-line/4'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 no-drag flex-shrink-0">
        {/* User avatar + dropdown */}
        <div ref={menuRef} className="relative">
          {user ? (
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-1 pl-1 pr-1.5 py-1 rounded-full hover:bg-line/5 transition-colors"
              title={user.login}
            >
              <img
                src={user.avatar_url}
                alt={user.login}
                className="w-7 h-7 rounded-full flex-shrink-0"
              />
              <ChevronDown
                size={12}
                className={`text-muted transition-transform ${menuOpen ? 'rotate-180' : ''}`}
              />
            </button>
          ) : (
            <button
              onClick={() => (onSignIn ? onSignIn() : onNavigate('settings'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors hover:bg-line/10 text-muted border border-line/8"
            >
              <Github size={13} />
              Sign in
            </button>
          )}

          {/* Dropdown menu */}
          {menuOpen && user && (
            <div
              className="absolute right-0 top-full mt-1.5 w-56 rounded-[10px] py-1 shadow-2xl z-50 bg-card border border-line/8"
            >
              {/* Identity row */}
              <button
                onClick={openProfile}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-line/5 transition-colors text-left"
              >
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="w-8 h-8 rounded-full flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-foreground text-sm font-medium truncate">{user.login}</p>
                  <p className="text-muted text-xs">View profile</p>
                </div>
              </button>

              <div className="h-px bg-line/6 my-1" />

              <button
                onClick={handleMenuLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-line/5 transition-colors text-left text-[13px]"
              >
                <LogOut size={14} className="text-muted" />
                <span className="text-foreground">Log out</span>
              </button>
            </div>
          )}
        </div>

        {!isMac && <WindowControls />}
      </div>
    </div>
  );
}
