import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ExpandableTextProps {
  /** Plain text content. Prefer over children when no rich content is needed. */
  text?: string;
  /** Rich content. Takes precedence over `text` when both are given. */
  children?: ReactNode;
  /** Max visible lines before the toggle appears. Default: 3. */
  lines?: number;
  className?: string;
}

/**
 * Truncates long content with a CSS line-clamp and shows a
 * "Show more"/"Show less" toggle only when the content actually overflows
 * (measured via scrollHeight > clientHeight). Safe to use inside flex rows.
 */
export default function ExpandableText({
  text,
  children,
  lines = 3,
  className = '',
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Overflow only means something while collapsed: skip measuring when the
  // text is expanded, then re-measure once it collapses again.
  useEffect(() => {
    if (expanded) return;
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      setNeedsToggle(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, lines]);

  const content = children ?? (text != null ? text : null);

  return (
    <div className={`min-w-0 ${className}`}>
      <div
        ref={ref}
        className="text-inherit break-words"
        style={
          expanded || !needsToggle
            ? undefined
            : {
                display: '-webkit-box',
                WebkitLineClamp: lines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
        }
      >
        {content}
      </div>
      {needsToggle && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="mt-1 flex items-center gap-0.5 text-xs font-medium text-muted hover:text-foreground transition-colors select-none"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
