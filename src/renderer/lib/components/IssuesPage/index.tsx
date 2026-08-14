import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Inbox, MessageSquare, RefreshCw, TriangleAlert } from 'lucide-react';
import type { Issue, IssueLabel } from '../../types';
import Card from '../base/Card';
import Button from '../base/Button';
import IconButton from '../base/IconButton';
import { timeAgo } from '../../utils/format';

type StateFilter = 'open' | 'closed' | 'all';
type SortMode = 'newest' | 'oldest' | 'comments';

const STATE_FILTERS: { value: StateFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
];

const SORT_MODES: { value: SortMode; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'comments', label: 'Most commented' },
];

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)(\.git)?/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [labels, setLabels] = useState<IssueLabel[]>([]);
  const [stateFilter, setStateFilter] = useState<StateFilter>('open');
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggleExpanded = (number: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const cfg = await window.electron.config.read();
      if (!cfg.success || !cfg.data?.reports_repo) {
        throw new Error('No reports repository configured. Add reports_repo to config.yaml.');
      }
      const parsed = parseRepoUrl(cfg.data.reports_repo);
      if (!parsed) throw new Error('Invalid reports_repo in config.yaml.');
      const [issuesRes, labelsRes] = await Promise.all([
        window.electron.github.getIssues({ ...parsed, state: 'all', per_page: 100 }),
        window.electron.github.getLabels(parsed),
      ]);
      if (!issuesRes.success) throw new Error(issuesRes.error || 'Failed to load issues');
      if (!labelsRes.success) throw new Error(labelsRes.error || 'Failed to load labels');
      setIssues(issuesRes.data ?? []);
      setLabels(labelsRes.data ?? []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load issues');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleIssues = issues
    .filter(i => stateFilter === 'all' || i.state === stateFilter)
    .filter(i => !labelFilter || i.labels.some(l => l.name === labelFilter))
    .sort((a, b) => {
      if (sortMode === 'newest') return +new Date(b.created_at) - +new Date(a.created_at);
      if (sortMode === 'oldest') return +new Date(a.created_at) - +new Date(b.created_at);
      return b.comments - a.comments || +new Date(b.created_at) - +new Date(a.created_at);
    });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-line/6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-foreground font-semibold text-base">Issues</h2>
          <div className="flex items-center gap-0.5">
            {STATE_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStateFilter(f.value)}
                className={`px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors whitespace-nowrap ${
                  stateFilter === f.value ? 'bg-line/8 text-foreground' : 'text-muted hover:bg-line/4'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5">
            {SORT_MODES.map(s => (
              <button
                key={s.value}
                onClick={() => setSortMode(s.value)}
                className={`px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors whitespace-nowrap ${
                  sortMode === s.value ? 'bg-line/8 text-foreground' : 'text-muted hover:bg-line/4'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={RefreshCw}
          disabled={isLoading}
          onClick={() => void load()}
        >
          Refresh
        </Button>
      </div>

      {labels.length > 0 && (
        <div className="flex items-center gap-1.5 px-6 py-2.5 border-b border-line/6 flex-shrink-0 overflow-x-auto">
          <button
            onClick={() => setLabelFilter(null)}
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
              labelFilter === null ? 'bg-line/8 text-foreground' : 'text-muted hover:bg-line/4'
            }`}
          >
            All labels
          </button>
          {labels.map(l => (
            <button
              key={l.name}
              onClick={() => setLabelFilter(labelFilter === l.name ? null : l.name)}
              className="text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap transition-opacity"
              style={{
                background: `#${l.color}1f`,
                color: `#${l.color}`,
                border: `1px solid #${l.color}33`,
                opacity: labelFilter === null || labelFilter === l.name ? 1 : 0.4,
              }}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <Card className="p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-line/10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 rounded bg-line/10 w-2/3" />
                      <div className="h-2.5 rounded bg-line/10 w-1/3" />
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <TriangleAlert size={28} className="text-warning" />
            <p className="text-foreground text-sm font-medium">Couldn&apos;t load issues</p>
            <p className="text-muted text-xs max-w-sm text-center">{error}</p>
            <Button variant="soft" size="sm" icon={RefreshCw} onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : visibleIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Inbox size={28} className="text-muted" />
            <p className="text-foreground text-sm font-medium">
              {issues.length === 0 ? 'No issues yet' : 'No issues match these filters'}
            </p>
            <p className="text-muted text-xs max-w-sm text-center">
              {issues.length === 0
                ? 'The bug tracker is empty. Issues will appear here once they are opened on GitHub.'
                : 'Try a different state, label, or clear the filters.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visibleIssues.map(issue => (
              <Card key={issue.number} className="p-3.5">
                <div className="flex items-start gap-3">
                  <span
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      issue.state === 'open' ? 'bg-success' : 'bg-muted'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="text-foreground text-sm font-medium leading-snug">
                          {issue.title}
                        </span>
                        <span className="text-muted text-xs flex-shrink-0">#{issue.number}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {issue.body?.trim() ? (
                          <button
                            onClick={() => toggleExpanded(issue.number)}
                            className="flex items-center gap-1 px-1.5 py-1 rounded-[6px] text-xs text-muted hover:text-foreground hover:bg-line/4 transition-colors"
                          >
                            {expanded.has(issue.number) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            <span>Description</span>
                          </button>
                        ) : null}
                        <IconButton
                          label="Open in GitHub"
                          icon={ExternalLink}
                          iconSize={13}
                          sizeClass="w-6 h-6"
                          onClick={() => window.electron.app.openExternal(issue.html_url)}
                        />
                      </div>
                    </div>
                    {issue.body?.trim() && expanded.has(issue.number) && (
                      <div className="mt-2.5 pt-2.5 border-t border-line/6 text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap break-words">
                        {issue.body}
                      </div>
                    )}
                    {issue.labels.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {issue.labels.map(l => (
                          <span
                            key={l.name}
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{
                              background: `#${l.color}1f`,
                              color: `#${l.color}`,
                              border: `1px solid #${l.color}33`,
                            }}
                          >
                            {l.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-muted text-xs">
                      <img
                        src={issue.user.avatar_url}
                        alt={issue.user.login}
                        className="w-4 h-4 rounded-full flex-shrink-0"
                      />
                      <span className="truncate">{issue.user.login}</span>
                      <span className="flex-shrink-0">{timeAgo(issue.created_at)}</span>
                      {issue.comments > 0 && (
                        <span className="flex items-center gap-1 flex-shrink-0">
                          <MessageSquare size={11} />
                          {issue.comments}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
