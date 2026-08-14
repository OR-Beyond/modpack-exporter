import React from 'react';
import type { ProfileMode } from '../../types';

interface ModeToggleProps {
  mode: ProfileMode;
  onChange: (mode: ProfileMode) => void;
  disabled?: boolean;
}

export default function ModeToggle({ mode, onChange, disabled = false }: ModeToggleProps) {
  const isProd = mode === 'prod';

  const thumbStyle = isProd
    ? {
        left: 'calc(50% + 2px)',
        backgroundColor: 'rgb(var(--color-primary) / 0.12)',
        borderColor: 'rgb(var(--color-primary) / 0.4)',
      }
    : {
        left: '2px',
        backgroundColor: 'rgb(var(--color-warning) / 0.12)',
        borderColor: 'rgb(var(--color-warning) / 0.4)',
      };

  const labelClass = (active: boolean, colorVar: string) =>
    `relative z-10 flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
      active ? colorVar : 'text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div
      role="radiogroup"
      aria-label="App mode"
      className={`relative flex p-0.5 rounded-lg border border-line/8 bg-subtle select-none ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <span
        aria-hidden="true"
        className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md border transition-all duration-200 ease-out"
        style={thumbStyle}
      />
      <button
        type="button"
        role="radio"
        aria-checked={!isProd}
        onClick={() => onChange('dev')}
        className={labelClass(!isProd, 'text-warning')}
      >
        Development
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={isProd}
        onClick={() => onChange('prod')}
        className={labelClass(isProd, 'text-primary')}
      >
        Production
      </button>
    </div>
  );
}
