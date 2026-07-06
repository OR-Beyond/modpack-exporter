import React, { useEffect, useRef, useState } from 'react';
import { Settings, Minus, X, ChevronDown, LogOut, User, Github } from 'lucide-react';
import type { GitHubUser } from '../../types';

interface Props {
  user: GitHubUser | null;
  onExport: () => void;
  onSettings: () => void;
  onLogout: () => void;
}

export default function Header({ user, onExport, onSettings, onLogout }: Props) {
  const isWin = window.electron.platform === 'win32';
  const isMac = window.electron.platform === 'darwin';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Click-outside to close dropdown
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

  const handleMenuSettings = () => {
    setMenuOpen(false);
    onSettings();
  };

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
      className="flex items-center justify-between h-14 bg-[#1E1E1E] border-b border-white/[0.06] flex-shrink-0 drag-region"
      style={{ minHeight: 56, paddingLeft: isMac ? 2 : 20, paddingRight: 20 }}
    >
      {isMac && (
        <div className="flex items-center gap-1 pl-2 pr-3 no-drag">
          <button
            onClick={() => window.electron.app.close()}
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:brightness-75 transition-all"
            style={{ background: '#E24729' }}
            aria-label="Close"
            title="Close"
          />
          <button
            onClick={() => window.electron.app.minimize()}
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:brightness-75 transition-all"
            style={{ background: '#FFBD2E' }}
            aria-label="Minimize"
            title="Minimize"
          />
          <div
            className="w-3.5 h-3.5 rounded-full"
            style={{ background: '#28C840' }}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Left: logo + title */}
      <div className="flex items-center gap-3 no-drag">
        <div
          className="w-8 h-8 rounded-[10px] flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #E24729 0%, #FF3F6E 100%)' }}
        >
          O
        </div>
        <span className="font-semibold text-white text-[15px] tracking-tight whitespace-nowrap">
          ORB Modpack Exporter
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 no-drag">
        {/* User avatar + dropdown */}
        <div ref={menuRef} className="relative">
          {user ? (
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-1 pl-1 pr-1.5 py-1 rounded-full hover:bg-white/5 transition-colors"
              title={user.login}
            >
              <img
                src={user.avatar_url}
                alt={user.login}
                className="w-7 h-7 rounded-full flex-shrink-0"
              />
              <ChevronDown
                size={12}
                className={`text-[#A9A9AB] transition-transform ${menuOpen ? 'rotate-180' : ''}`}
              />
            </button>
          ) : (
            <button
              onClick={onSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors hover:bg-white/10"
              style={{ color: '#A9A9AB', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <Github size={13} />
              Sign in
            </button>
          )}

          {/* Dropdown menu */}
          {menuOpen && user && (
            <div
              className="absolute right-0 top-full mt-1.5 w-56 rounded-[10px] py-1 shadow-2xl z-50"
              style={{ background: '#323234', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {/* Identity row */}
              <button
                onClick={openProfile}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors text-left"
              >
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="w-8 h-8 rounded-full flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{user.login}</p>
                  <p className="text-[#A9A9AB] text-xs">View profile</p>
                </div>
              </button>

              <div className="h-px bg-white/[0.06] my-1" />

              <button
                onClick={handleMenuSettings}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors text-left text-[13px]"
              >
                <Settings size={14} className="text-[#A9A9AB]" />
                <span className="text-white">Settings</span>
              </button>

              <button
                onClick={handleMenuLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors text-left text-[13px]"
              >
                <LogOut size={14} className="text-[#A9A9AB]" />
                <span className="text-white">Log out</span>
              </button>
            </div>
          )}
        </div>

        {/* Settings cog (alternative trigger) */}
        <button
          onClick={onSettings}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Settings"
          title="Settings"
        >
          <Settings size={16} className="text-[#A9A9AB]" />
        </button>

        {/* Export */}
        <button
          onClick={onExport}
          className="px-4 py-1.5 rounded-[8px] text-white text-sm font-medium transition-all"
          style={{ background: '#0890FE' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1a9dff')}
          onMouseLeave={e => (e.currentTarget.style.background = '#0890FE')}
        >
          Export New Version
        </button>

        {!isMac && (
          <div className="flex items-center gap-0.5 ml-1">
            <button
              onClick={() => window.electron.app.minimize()}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
              aria-label="Minimize"
            >
              <Minus size={13} className="text-[#A9A9AB]" />
            </button>
            <button
              onClick={() => window.electron.app.close()}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#E24729] transition-colors"
              aria-label="Close"
            >
              <X size={13} className="text-[#A9A9AB]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
