import React from 'react';
import { Minus, X } from 'lucide-react';

/**
 * Platform-aware window control buttons.
 *
 * On macOS: renders traffic-light circles (close, minimize, zoom) on the left.
 * On Windows/Linux: renders minimize and close icon buttons on the right.
 *
 * The drag region is handled by the parent element, so each button is
 * explicitly `no-drag` to stay clickable.
 */
export default function WindowControls() {
  const isMac = window.electron.platform === 'darwin';

  if (isMac) {
    return (
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
    );
  }

  return (
    <div className="flex items-center gap-0.5 no-drag">
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
  );
}
