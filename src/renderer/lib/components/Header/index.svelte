<!--
  Top bar — logo, primary nav, user menu, window controls.
  Drag region is handled here; interactive children are marked `no-drag`.
-->
<script lang="ts">
  import Settings from '@lucide/svelte/icons/settings';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import LogOut from '@lucide/svelte/icons/log-out';
  import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
  import ScrollText from '@lucide/svelte/icons/scroll-text';
  import History from '@lucide/svelte/icons/history';
  import CircleDot from '@lucide/svelte/icons/circle-dot';
  import type { Component } from 'svelte';
  import type { GitHubUser } from '../../types';
  import appIcon from '../../../assets/icon.png';
  import WindowControls from '../WindowControls.svelte';
  import GithubIcon from '../common/GithubIcon.svelte';
  import { ipc } from '../../ipc';

  export type Page = 'home' | 'history' | 'issues' | 'settings' | 'logs';

  interface Props {
    user: GitHubUser | null;
    currentPage: Page;
    onNavigate: (page: Page) => void;
    onLogout: () => void;
    /** When `user` is null, the Sign-in button calls this instead of navigating. */
    onSignIn?: () => void;
  }

  let { user, currentPage, onNavigate, onLogout, onSignIn }: Props = $props();

  const isMac = ipc.platform === 'darwin';

  const isDevBuild = import.meta.env.DEV || (typeof __DEV__ !== 'undefined' && __DEV__);
  const navItems: { page: Page; label: string; icon: Component<{ size?: number }> }[] = [
    { page: 'home', label: 'Home', icon: LayoutDashboard },
    { page: 'history', label: 'History', icon: History },
    { page: 'issues', label: 'Issues', icon: CircleDot },
    ...(isDevBuild ? [{ page: 'logs' as Page, label: 'Logs', icon: ScrollText }] : []),
    { page: 'settings', label: 'Settings', icon: Settings },
  ];

  let menuOpen = $state(false);
  let menuRef: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef && !menuRef.contains(e.target as Node)) {
        menuOpen = false;
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  });

  function handleMenuLogout() {
    menuOpen = false;
    onLogout();
  }

  function openProfile() {
    if (user?.html_url) ipc.app.openExternal(user.html_url);
    menuOpen = false;
  }
</script>

<div
  class="flex items-center justify-between h-14 bg-background border-b border-line/6 flex-shrink-0 drag-region"
  style="min-height: 56px; padding-left: {isMac ? 2 : 16}px; padding-right: 20px;"
>
  {#if isMac}<WindowControls />{/if}

  <!-- Left: logo + title + nav -->
  <div class="flex items-center gap-1 no-drag min-w-0">
    <span class="flex items-center gap-3 mr-4 flex-shrink-0">
      <img src={appIcon} alt="ORB" class="w-8 h-8 rounded-[10px] flex-shrink-0 object-cover" />
      <span class="font-semibold text-foreground text-[15px] tracking-tight whitespace-nowrap hidden sm:inline">
        ORB Modpack Exporter
      </span>
    </span>

    <!-- Nav items -->
    <nav class="flex items-center gap-0.5">
      {#each navItems as item (item.page)}
        <button
          onclick={() => onNavigate(item.page)}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-sm font-medium transition-colors whitespace-nowrap {currentPage ===
          item.page
            ? 'bg-line/8 text-foreground'
            : 'text-muted hover:bg-line/4'}"
        >
          <item.icon size={16} />
          <span>{item.label}</span>
        </button>
      {/each}
    </nav>
  </div>

  <!-- Right: actions -->
  <div class="flex items-center gap-2 no-drag flex-shrink-0">
    <!-- User avatar + dropdown -->
    <div bind:this={menuRef} class="relative">
      {#if user}
        <button
          onclick={() => (menuOpen = !menuOpen)}
          class="flex items-center gap-1 pl-1 pr-1.5 py-1 rounded-full hover:bg-line/5 transition-colors"
          title={user.login}
        >
          <img src={user.avatar_url} alt={user.login} class="w-7 h-7 rounded-full flex-shrink-0" />
          <ChevronDown
            size={12}
            class="text-muted transition-transform {menuOpen ? 'rotate-180' : ''}"
          />
        </button>
      {:else}
        <button
          onclick={() => (onSignIn ? onSignIn() : onNavigate('settings'))}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors hover:bg-line/10 text-muted border border-line/8"
        >
          <GithubIcon size={13} />
          Sign in
        </button>
      {/if}

      <!-- Dropdown menu -->
      {#if menuOpen && user}
        <div class="absolute right-0 top-full mt-1.5 w-56 rounded-[10px] py-1 shadow-2xl z-50 bg-card border border-line/8">
          <!-- Identity row -->
          <button
            onclick={openProfile}
            class="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-line/5 transition-colors text-left"
          >
            <img src={user.avatar_url} alt={user.login} class="w-8 h-8 rounded-full flex-shrink-0" />
            <div class="min-w-0">
              <p class="text-foreground text-sm font-medium truncate">{user.login}</p>
              <p class="text-muted text-xs">View profile</p>
            </div>
          </button>

          <div class="h-px bg-line/6 my-1"></div>

          <button
            onclick={handleMenuLogout}
            class="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-line/5 transition-colors text-left text-[13px]"
          >
            <LogOut size={14} class="text-muted" />
            <span class="text-foreground">Log out</span>
          </button>
        </div>
      {/if}
    </div>

    {#if !isMac}<WindowControls />{/if}
  </div>
</div>
