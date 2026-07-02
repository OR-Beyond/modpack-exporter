import React from 'react';
import { Loader2, Download, AlertTriangle, RotateCw, Package } from 'lucide-react';

export type InitState = 'cloning' | 'pulling' | 'error';

export interface InitProgress {
  stage: string;
  message: string;
  percent: number;
}

interface Props {
  /** Current phase of first-run initialization. */
  state: InitState;
  /** Latest progress event from the pull (null while cloning / before first event). */
  progress: InitProgress | null;
  /** Error message when `state === 'error'`. */
  error: string | null;
  /** Retry the whole initialization (clone + pull) from the top. */
  onRetry: () => void;
}

/**
 * Full-height panel shown in the dashboard body during first-run setup while the
 * versions repo is cloned and the initial modpack pull downloads every mod +
 * override. Replaces the empty ActivityFeed/Sidebar so the user is never left
 * staring at a blank dashboard with no mods.
 */
export default function InitialSetupScreen({ state, progress, error, onRetry }: Props) {
  // ── Error state ────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center overflow-hidden px-6">
        <div
          className="w-full max-w-[440px] rounded-[14px] p-7 flex flex-col items-center text-center shadow-2xl"
          style={{ background: '#26262A', border: '1px solid rgba(248,81,73,0.28)' }}
        >
          <div
            className="w-12 h-12 rounded-[12px] flex items-center justify-center mb-4"
            style={{ background: 'rgba(248,81,73,0.14)' }}
          >
            <AlertTriangle size={22} style={{ color: '#f85149' }} />
          </div>
          <h2 className="text-white font-semibold text-[17px] mb-1.5">Setup couldn’t finish</h2>
          <p className="text-[#A9A9AB] text-sm leading-relaxed mb-1">
            We couldn’t download the modpack. Your files were not changed — you can safely retry.
          </p>
          {error && (
            <p
              className="text-xs font-mono mt-2 mb-4 px-3 py-2 rounded-[8px] w-full break-words"
              style={{ background: '#1E1E1E', color: '#f0a5a0', border: '1px solid rgba(248,81,73,0.2)' }}
            >
              {error}
            </p>
          )}
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-5 py-2.5 rounded-[8px] text-white text-sm font-medium transition-all mt-2"
            style={{ background: '#0890FE' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1a9dff')}
            onMouseLeave={e => (e.currentTarget.style.background = '#0890FE')}
          >
            <RotateCw size={15} />
            Retry setup
          </button>
        </div>
      </div>
    );
  }

  // ── Cloning / pulling state ────────────────────────────────────────────────
  const isCloning = state === 'cloning';

  // While cloning we have no percentage — show an indeterminate bar. During the
  // pull we track the real percent reported by the sync:progress events.
  const percent = isCloning ? null : Math.max(0, Math.min(100, progress?.percent ?? 0));

  const heading = isCloning ? 'Setting things up…' : 'Downloading modpack…';
  const subtext = isCloning
    ? 'Connecting to the versions repository.'
    : 'This may take a few minutes on first setup — grabbing every mod and override for your profile.';
  const detail = isCloning
    ? 'Preparing versions repository'
    : progress?.message || 'Starting download…';

  return (
    <div className="flex flex-1 items-center justify-center overflow-hidden px-6">
      <div
        className="w-full max-w-[460px] rounded-[14px] p-8 flex flex-col items-center text-center shadow-2xl"
        style={{ background: '#26262A', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Icon badge */}
        <div
          className="w-14 h-14 rounded-[14px] flex items-center justify-center mb-5 relative"
          style={{ background: 'linear-gradient(135deg, #E24729 0%, #FF3F6E 100%)' }}
        >
          {isCloning ? (
            <Package size={24} className="text-white" />
          ) : (
            <Download size={24} className="text-white" />
          )}
        </div>

        <h2 className="text-white font-semibold text-[18px] mb-2">{heading}</h2>
        <p className="text-[#A9A9AB] text-sm leading-relaxed mb-6 max-w-[360px]">{subtext}</p>

        {/* Progress bar */}
        <div
          className="w-full h-2 rounded-full overflow-hidden mb-3 relative"
          style={{ background: '#1E1E1E' }}
        >
          {percent === null ? (
            // Indeterminate sweep while cloning
            <div
              className="absolute top-0 bottom-0 w-1/3 rounded-full initial-setup-indeterminate"
              style={{ background: 'linear-gradient(90deg, #E24729 0%, #FF3F6E 100%)' }}
            />
          ) : (
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-out"
              style={{
                width: `${percent}%`,
                background: 'linear-gradient(90deg, #E24729 0%, #FF3F6E 100%)',
              }}
            />
          )}
        </div>

        {/* Live detail line */}
        <div className="flex items-center gap-2 text-xs text-[#A9A9AB] min-h-[18px] w-full justify-center">
          <Loader2 size={12} className="animate-spin flex-shrink-0" />
          <span className="truncate" title={detail}>{detail}</span>
          {percent !== null && <span className="tabular-nums flex-shrink-0">· {percent}%</span>}
        </div>
      </div>

      {/* Keyframes for the indeterminate clone bar */}
      <style>{`
        @keyframes initial-setup-indeterminate {
          0%   { left: -35%; }
          100% { left: 100%; }
        }
        .initial-setup-indeterminate {
          animation: initial-setup-indeterminate 1.1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
