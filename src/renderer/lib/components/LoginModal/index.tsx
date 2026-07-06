import React, { useEffect, useRef, useState } from 'react';
import { Copy, ExternalLink, Github, Loader2, X, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { DeviceCodeInfo } from '../../types';

interface Props {
  /** Closes the modal. If the device flow is still pending, this also aborts it. */
  onClose: () => void;
  /** Called after the device flow succeeds and the token is stored. */
  onSuccess: () => void;
}

type Status = 'requesting' | 'waiting' | 'success' | 'error';

export default function LoginModal({ onClose, onSuccess }: Props) {
  const [status, setStatus] = useState<Status>('requesting');
  const [codeInfo, setCodeInfo] = useState<DeviceCodeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Track unmount so async resolves don't update state
  const cancelledRef = useRef(false);

  // ── Start the device flow on mount ─────────────────────────────────────────
  useEffect(() => {
    cancelledRef.current = false;

    window.electron.auth.onDeviceCode(info => {
      if (cancelledRef.current) return;
      setCodeInfo(info);
      setStatus('waiting');
      setSecondsLeft(info.expires_in);
      // Auto-open the verification page in the default browser
      window.electron.app.openExternal(info.verification_uri).catch(() => {});
    });

    window.electron.auth
      .start()
      .then(result => {
        if (cancelledRef.current) return;
        if (result.success) {
          setStatus('success');
          // Brief success state, then notify parent
          setTimeout(() => {
            if (!cancelledRef.current) onSuccess();
          }, 800);
        } else {
          setStatus('error');
          setError(result.error || 'Authentication failed');
        }
      })
      .catch(e => {
        if (cancelledRef.current) return;
        setStatus('error');
        setError(e?.message || String(e));
      });

    return () => {
      cancelledRef.current = true;
      window.electron.auth.offDeviceCode();
    };
  }, [onSuccess]);

  // ── Countdown ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (secondsLeft === null || status !== 'waiting') return;
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft(s => (s !== null && s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft, status]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCancel = async () => {
    cancelledRef.current = true;
    await window.electron.auth.logout().catch(() => {});
    onClose();
  };

  const handleCopy = async () => {
    if (!codeInfo) return;
    try {
      await navigator.clipboard.writeText(codeInfo.user_code);
      toast.success('Code copied to clipboard');
    } catch {
      toast.error('Could not copy code');
    }
  };

  const handleOpenBrowser = () => {
    if (!codeInfo) return;
    window.electron.app.openExternal(codeInfo.verification_uri).catch(() => {});
  };

  const formatExpiry = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[60]"
      style={{ background: 'rgba(0,0,0,0.78)' }}
    >
      <div
        className="w-[440px] rounded-[12px] overflow-hidden shadow-2xl"
        style={{ background: '#323234' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Github size={16} className="text-white" />
            <h2 className="text-white font-semibold text-base">Sign in to GitHub</h2>
          </div>
          {status !== 'success' && (
            <button
              onClick={handleCancel}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Cancel"
            >
              <X size={15} className="text-[#A9A9AB]" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {status === 'requesting' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={28} className="animate-spin text-[#A9A9AB]" />
              <p className="text-[#A9A9AB] text-sm">Requesting device code…</p>
            </div>
          )}

          {status === 'waiting' && codeInfo && (
            <>
              <p className="text-[#A9A9AB] text-sm mb-5 leading-relaxed">
                Enter the code below at{' '}
                <button
                  onClick={handleOpenBrowser}
                  className="inline-flex items-center gap-0.5 hover:underline"
                  style={{ color: '#0890FE' }}
                >
                  {codeInfo.verification_uri.replace(/^https?:\/\//, '')}
                  <ExternalLink size={11} />
                </button>{' '}
                to authorize this app.
              </p>

              {/* User code */}
              <div
                className="rounded-[12px] p-5 flex flex-col items-center gap-3 mb-5"
                style={{ background: '#1E1E1E', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span
                  className="font-mono font-bold text-white tracking-[0.3em] select-text"
                  style={{ fontSize: 32, lineHeight: 1.1 }}
                >
                  {codeInfo.user_code}
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors hover:bg-white/10"
                  style={{ color: '#A9A9AB', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <Copy size={12} />
                  Copy code
                </button>
              </div>

              {/* Status row */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#A9A9AB]">
                  <Loader2 size={12} className="animate-spin" />
                  Waiting for approval…
                </div>
                {secondsLeft !== null && secondsLeft > 0 && (
                  <span className="text-[#A9A9AB] font-mono">{formatExpiry(secondsLeft)}</span>
                )}
              </div>
            </>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(32,172,100,0.18)' }}
              >
                <Check size={24} style={{ color: '#20AC64' }} />
              </div>
              <p className="text-white text-sm font-medium">Signed in successfully</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(226,71,41,0.18)' }}
              >
                <AlertCircle size={24} style={{ color: '#E24729' }} />
              </div>
              <p className="text-white text-sm font-medium">Sign-in failed</p>
              {error && <p className="text-[#A9A9AB] text-xs max-w-[320px]">{error}</p>}
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 rounded-[8px] text-white text-sm font-medium transition-all"
                style={{ background: '#0890FE' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1a9dff')}
                onMouseLeave={e => (e.currentTarget.style.background = '#0890FE')}
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* Footer with cancel during wait */}
        {status === 'waiting' && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.06]">
            <button
              onClick={handleOpenBrowser}
              className="flex items-center gap-1.5 text-xs font-medium hover:underline"
              style={{ color: '#0890FE' }}
            >
              Open browser <ExternalLink size={11} />
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 rounded-[8px] text-[#A9A9AB] text-xs font-medium hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
