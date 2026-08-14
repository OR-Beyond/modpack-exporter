import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleListProps<T> {
  items: T[];
  /** Renders a single item row. */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Stable key per item (defaults to the item index). */
  getKey?: (item: T, index: number) => string;
  /** How many rows are shown before "Show all". */
  limit?: number;
  className?: string;
}

/** Renders the first N items with a "Show all N" expander when there are more. */
export default function CollapsibleList<T>({
  items,
  renderItem,
  getKey,
  limit = 5,
  className = '',
}: CollapsibleListProps<T>) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, limit);
  const hidden = items.length - limit;

  return (
    <div className={className}>
      {visible.map((item, i) => (
        <React.Fragment key={getKey ? getKey(item, i) : i}>{renderItem(item, i)}</React.Fragment>
      ))}
      {!expanded && hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 text-xs transition-opacity hover:opacity-75 text-muted"
        >
          <ChevronDown size={11} />
          Show all {items.length}
        </button>
      )}
    </div>
  );
}
