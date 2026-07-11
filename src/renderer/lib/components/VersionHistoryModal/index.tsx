import React, { useEffect, useState } from 'react';
import { X, RotateCcw, Clock, Hash, User, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { VersionRecord } from '../../types';

interface Props {
  onClose: () => void;
}

export default function VersionHistoryModal({ onClose }: Props) {
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await window.electron.versions.list();
      if (r.success && r.data) {
        setVersions(r.data);
      } else {
        setError(r.error || 'Failed to load version history');
      }
      setLoading(false);
    })();
  }, []);

  const handleRollback = async (versionId: string) => {
    const confirmed = window.confirm(
      'Rollback to this version? This will revert the modpack for all team members.'
    );
    if (!confirmed) return;

    setRollingBack(versionId);
    const tid = toast.loading('Rolling back...');
    try {
      const r = await window.electron.versions.rollback(versionId);
      toast.dismiss(tid);
      if (r.success) {
        toast.success(r.message || 'Rolled back successfully');
        onClose();
      } else {
        toast.error(`Rollback failed: ${r.error}`);
      }
    } catch (e: any) {
      toast.dismiss(tid);
      toast.error(`Rollback failed: ${e?.message}`);
    } finally {
      setRollingBack(null);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[520px] rounded-[12px] overflow-hidden shadow-2xl flex flex-col" style={{ background: '#323234', maxHeight: 'min(92vh, 700px)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-white font-semibold text-base">Version History</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={15} className="text-[#A9A9AB]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 size={20} className="animate-spin text-[#A9A9AB]" />
              <p className="text-[#A9A9AB] text-sm">Loading version history...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertCircle size={24} className="text-[#FFA809]" />
              <p className="text-[#A9A9AB] text-sm">{error}</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Clock size={24} className="text-[#A9A9AB]" />
              <p className="text-[#A9A9AB] text-sm">No version history yet.</p>
              <p className="text-[#585858] text-xs">Versions are recorded after each successful push.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {[...versions].reverse().map((v, i) => (
                <div
                  key={v.id}
                  className="rounded-[10px] p-3.5 flex items-start justify-between gap-3"
                  style={{ background: '#1E1E1E', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white text-sm font-medium">v{v.manifestVersion}</span>
                      {i === 0 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ background: 'rgba(32,172,100,0.15)', color: '#20AC64' }}
                        >
                          latest
                        </span>
                      )}
                    </div>
                    <p className="text-[#D4D4D4] text-xs leading-relaxed line-clamp-2">{v.message}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-[#585858] text-xs">
                        <User size={10} />
                        {v.author}
                      </span>
                      <span className="flex items-center gap-1 text-[#585858] text-xs">
                        <Clock size={10} />
                        {formatDate(v.timestamp)}
                      </span>
                      <span className="flex items-center gap-1 text-[#585858] text-xs font-mono">
                        <Hash size={10} />
                        {v.commitSha.substring(0, 7)}
                      </span>
                    </div>
                  </div>
                  {i > 0 && (
                    <button
                      onClick={() => handleRollback(v.id)}
                      disabled={rollingBack !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all flex-shrink-0 disabled:opacity-50"
                      style={{ color: '#FFA809', border: '1px solid rgba(255,168,9,0.35) ' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,168,9,0.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {rollingBack === v.id ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <RotateCcw size={11} />
                      )}
                      Rollback
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
