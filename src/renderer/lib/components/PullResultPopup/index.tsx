import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { PullFileChange, PullModEntry, PullModUpdate } from '../../types';
import Modal, { ModalHeader, ModalFooter } from '../base/Modal';
import Button from '../base/Button';
import ModIcon from '../common/ModIcon';
import ModStatusBadge from '../common/ModStatusBadge';
import Section from '../common/Section';
import CollapsibleList from '../common/CollapsibleList';

interface Props {
  addedMods: PullModEntry[];
  updatedMods: PullModUpdate[];
  removedMods: PullModEntry[];
  changedFiles: PullFileChange[];
  onDismiss: () => void;
}

const FILE_TONE_CLASSES = {
  added: 'bg-success/10 text-success',
  removed: 'bg-danger/10 text-danger',
  modified: 'bg-warning-soft/10 text-warning-soft',
} as const;

export default function PullResultPopup({
  addedMods,
  updatedMods,
  removedMods,
  changedFiles,
  onDismiss,
}: Props) {
  // Summary line in header
  const parts: string[] = [];
  if (updatedMods.length > 0) parts.push(`${updatedMods.length} updated`);
  if (addedMods.length > 0)   parts.push(`${addedMods.length} added`);
  if (removedMods.length > 0) parts.push(`${removedMods.length} removed`);
  if (changedFiles.length > 0) parts.push(`${changedFiles.length} file${changedFiles.length !== 1 ? 's' : ''} changed`);

  return (
    <Modal open onClose={onDismiss} widthClass="w-[520px]">
      <ModalHeader onClose={onDismiss}>
        <div className="flex items-center gap-2.5">
          <CheckCircle2 size={16} className="text-success flex-shrink-0" />
          <div>
            <p className="text-foreground font-semibold text-[15px] leading-tight">Sync Complete</p>
            {parts.length > 0 && (
              <p className="text-xs mt-0.5 text-muted-foreground">{parts.join(' · ')}</p>
            )}
          </div>
        </div>
      </ModalHeader>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
        {/* Updated mods */}
        <Section label="Updated" tone="warning" count={updatedMods.length}>
          <CollapsibleList
            items={updatedMods}
            getKey={mod => mod.slug}
            renderItem={(mod) => (
              <div className="flex items-center gap-3 min-w-0">
                <ModIcon iconUrl={mod.iconUrl} name={mod.name} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate leading-snug">{mod.name}</p>
                  {(mod.oldVersionNumber || mod.newVersionNumber) && (
                    <p className="text-[11px] font-mono mt-0.5 truncate text-muted-foreground">
                      {mod.oldVersionNumber ?? '?'} → {mod.newVersionNumber ?? '?'}
                    </p>
                  )}
                </div>
                <ModStatusBadge status="updated" versionNumber={mod.newVersionNumber} oldVersionNumber={mod.oldVersionNumber} />
              </div>
            )}
          />
        </Section>

        {/* Added mods */}
        <Section label="Added" tone="success" count={addedMods.length}>
          <CollapsibleList
            items={addedMods}
            getKey={mod => mod.slug}
            renderItem={(mod) => (
              <div className="flex items-center gap-3 min-w-0">
                <ModIcon iconUrl={mod.iconUrl} name={mod.name} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate leading-snug">{mod.name}</p>
                  {mod.versionNumber && (
                    <p className="text-[11px] font-mono mt-0.5 text-muted-foreground">
                      v{mod.versionNumber}
                    </p>
                  )}
                </div>
                <ModStatusBadge status="added" />
              </div>
            )}
          />
        </Section>

        {/* Removed mods */}
        <Section label="Removed" tone="danger" count={removedMods.length}>
          <CollapsibleList
            items={removedMods}
            getKey={mod => mod.slug}
            renderItem={(mod) => (
              <div className="flex items-center gap-3 min-w-0 opacity-70">
                <ModIcon iconUrl={mod.iconUrl} name={mod.name} size="lg" dimmed />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate leading-snug">{mod.name}</p>
                  {mod.versionNumber && (
                    <p className="text-[11px] font-mono mt-0.5 text-muted-foreground">
                      v{mod.versionNumber}
                    </p>
                  )}
                </div>
                <ModStatusBadge status="removed" />
              </div>
            )}
          />
        </Section>

        {/* Changed files */}
        <Section label="Files" tone="neutral" count={changedFiles.length}>
          <CollapsibleList
            items={changedFiles}
            getKey={file => file.path}
            renderItem={(file) => (
              <div className="flex items-center gap-2 min-w-0 py-0.5">
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 uppercase tracking-wide ${FILE_TONE_CLASSES[file.status]}`}
                >
                  {file.status}
                </span>
                <span
                  className="text-xs font-mono truncate text-foreground/80"
                  title={file.path}
                >
                  {file.path}
                </span>
              </div>
            )}
          />
        </Section>
      </div>

      {/* Footer */}
      <ModalFooter>
        <p className="text-xs text-muted-foreground mr-auto">
          Click anywhere outside or press "Got it" to dismiss
        </p>
        <Button variant="secondary" onClick={onDismiss}>
          Got it
        </Button>
      </ModalFooter>
    </Modal>
  );
}
