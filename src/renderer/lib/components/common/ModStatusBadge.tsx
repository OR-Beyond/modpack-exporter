import React from 'react';
import Badge from '../base/Badge';

export type ModStatus = 'added' | 'updated' | 'removed';

interface ModStatusBadgeProps {
  status: ModStatus;
  /** Shown as "old → new" when status is updated and versions differ. */
  versionNumber?: string | null;
  oldVersionNumber?: string | null;
}

/**
 * Per-mod status pill (added / updated / removed).
 * Shared by the activity feed, push preview and pull result popup.
 */
export default function ModStatusBadge({
  status,
  versionNumber,
  oldVersionNumber,
}: ModStatusBadgeProps) {
  if (status === 'added') {
    return <Badge tone="success">Added</Badge>;
  }
  if (status === 'removed') {
    return <Badge tone="danger">Removed</Badge>;
  }
  if (oldVersionNumber && versionNumber && oldVersionNumber !== versionNumber) {
    return (
      <span className="text-xs text-muted-foreground flex-shrink-0">
        {oldVersionNumber} → {versionNumber}
      </span>
    );
  }
  return <Badge tone="warning">Updated</Badge>;
}
