import React from 'react';
import { GitCommit, History, KeyRound, RefreshCw } from 'lucide-react';
import ActivityCard from './ActivityCard';
import Button from '../base/Button';
import Card from '../base/Card';
import type { CommitCard } from '../../types';

interface Props {
  commits: CommitCard[];
  isLoading: boolean;
  hasToken: boolean;
  onRefresh?: () => void;
  /** Cap the rendered list to the N most recent commits. */
  limit?: number;
  /** Renders a "View all" action in the header when provided. */
  onViewAll?: () => void;
  /** Hides the internal header — used when the page provides its own. */
  showHeader?: boolean;
  /** Shows absolute date/time instead of relative time (history page). */
  fullDate?: boolean;
}

function SkeletonCard() {
  return (
    <Card className="p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full flex-shrink-0 bg-line/6" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-3 w-24 rounded bg-line/6" />
            <div className="h-3 w-12 rounded bg-line/4" />
          </div>
          <div className="h-3 w-3/4 rounded mb-2 bg-line/6" />
          <div className="flex gap-1.5">
            <div className="h-4 w-16 rounded-full bg-line/5" />
            <div className="h-4 w-20 rounded-full bg-line/5" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function ActivityFeed({
  commits,
  isLoading,
  hasToken,
  onRefresh,
  limit,
  onViewAll,
  showHeader = true,
  fullDate = false,
}: Props) {
  const visibleCommits = limit ? commits.slice(0, limit) : commits;

  return (
    <div className="flex-1 overflow-y-auto p-5">
      {/* Header row: title + view all + refresh */}
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-foreground font-semibold text-base">Activity</h2>
          <div className="flex items-center gap-2">
            {onViewAll && (
              <Button variant="ghost" size="sm" icon={History} onClick={onViewAll}>
                View all
              </Button>
            )}
            {hasToken && onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                icon={RefreshCw}
                loading={isLoading}
                onClick={onRefresh}
                aria-label="Refresh activity"
                title="Refresh"
              >
                Refresh
              </Button>
            )}
          </div>
        </div>
      )}

      {/* No token */}
      {!hasToken && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-card flex items-center justify-center">
            <KeyRound size={22} className="text-muted" />
          </div>
          <p className="text-muted text-sm">Connect GitHub to see activity</p>
          <p className="text-muted-foreground text-xs max-w-[260px]">
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
          <div className="w-12 h-12 rounded-full bg-card flex items-center justify-center">
            <GitCommit size={22} className="text-muted" />
          </div>
          <p className="text-muted text-sm">No commits found</p>
        </div>
      )}

      {/* Commit list */}
      {visibleCommits.length > 0 && (
        <div className="flex flex-col gap-3">
          {visibleCommits.map(c => <ActivityCard key={c.sha} commit={c} fullDate={fullDate} />)}
        </div>
      )}
    </div>
  );
}
