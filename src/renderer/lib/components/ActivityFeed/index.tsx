import React from 'react';
import { GitCommit, KeyRound, RefreshCw, Loader2 } from 'lucide-react';
import ActivityCard from './ActivityCard';
import type { CommitCard } from '../../types';

interface Props {
  commits: CommitCard[];
  isLoading: boolean;
  hasToken: boolean;
  onRefresh?: () => void;
}

function SkeletonCard() {
  return (
    <div className="rounded-[12px] p-4 animate-pulse" style={{ background: '#323234' }}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-3 w-24 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <div className="h-3 w-12 rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
          </div>
          <div className="h-3 w-3/4 rounded mb-2" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="flex gap-1.5">
            <div className="h-4 w-16 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
            <div className="h-4 w-20 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ActivityFeed({ commits, isLoading, hasToken, onRefresh }: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-5">
      {/* Header row: title + refresh */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-[15px]">Activity</h2>
        {hasToken && onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-xs font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
            style={{ color: '#A9A9AB' }}
            aria-label="Refresh activity"
            title="Refresh"
          >
            {isLoading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Refresh
          </button>
        )}
      </div>

      {/* No token */}
      {!hasToken && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-[#323234] flex items-center justify-center">
            <KeyRound size={22} className="text-[#A9A9AB]" />
          </div>
          <p className="text-[#A9A9AB] text-sm">Connect GitHub to see activity</p>
          <p className="text-[#A9A9AB] text-xs max-w-[260px]">
            Sign in with GitHub in Settings to view commits, issues, and team changes.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {hasToken && isLoading && commits.length === 0 && (
        <div className="flex flex-col gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Empty state */}
      {hasToken && !isLoading && commits.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-12 h-12 rounded-full bg-[#323234] flex items-center justify-center">
            <GitCommit size={22} className="text-[#A9A9AB]" />
          </div>
          <p className="text-[#A9A9AB] text-sm">No commits found</p>
        </div>
      )}

      {/* Commit list */}
      {commits.length > 0 && (
        <div className="flex flex-col gap-3">
          {commits.map(c => <ActivityCard key={c.sha} commit={c} />)}
        </div>
      )}
    </div>
  );
}
