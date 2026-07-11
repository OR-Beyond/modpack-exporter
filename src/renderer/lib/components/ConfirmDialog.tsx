import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  description: string;
  details?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger' | 'warning';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const COLORS = {
  surface: '#323234',
  border: 'rgba(255,255,255,0.08)',
  divider: 'rgba(255,255,255,0.06)',
  muted: '#8b949e',
  accent: '#58a6ff',
  danger: '#f85149',
  warning: '#d2991d',
  btnGreen: '#238636',
  btnGreenHover: '#2ea043',
  btnDanger: '#da3633',
  btnDangerHover: '#f85149',
} as const;

export default function ConfirmDialog({
  open,
  title,
  description,
  details,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: Props) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const accentColor =
    variant === 'danger' ? COLORS.danger :
    variant === 'warning' ? COLORS.warning :
    COLORS.btnGreen;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[60]"
      style={{ background: 'rgba(0,0,0,0.75)' }}
    >
      <div
        className="w-[420px] rounded-[14px] overflow-hidden shadow-2xl"
        style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
      >
        {/* Icon */}
        <div className="flex justify-center pt-6 pb-2">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              background:
                variant === 'danger' ? 'rgba(248,81,73,0.12)' :
                variant === 'warning' ? 'rgba(210,153,29,0.12)' :
                'rgba(35,134,54,0.12)',
              border: `1px solid ${accentColor}30`,
            }}
          >
            <AlertTriangle
              size={20}
              style={{
                color: accentColor,
              }}
            />
          </div>
        </div>

        {/* Title */}
        <div className="px-6 text-center">
          <h3 className="text-white font-semibold text-[15px] mb-2">{title}</h3>
          <p className="text-sm leading-relaxed" style={{ color: COLORS.muted }}>
            {description}
          </p>
          {details && (
            <div
              className="mt-3 p-3 rounded-[8px] text-xs text-left font-mono whitespace-pre-wrap max-h-[120px] overflow-y-auto leading-relaxed"
              style={{
                background: '#0d1117',
                border: `1px solid ${COLORS.divider}`,
                color: COLORS.muted,
              }}
            >
              {details}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 mt-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-[8px] text-sm transition-colors disabled:opacity-40"
            style={{ color: COLORS.muted }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-white text-sm font-medium transition-all disabled:opacity-40"
            style={{ background: accentColor }}
            onMouseEnter={e => {
              if (!loading) {
                e.currentTarget.style.background =
                  variant === 'danger' ? COLORS.btnDangerHover :
                  variant === 'warning' ? COLORS.warning :
                  COLORS.btnGreenHover;
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = accentColor;
            }}
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
