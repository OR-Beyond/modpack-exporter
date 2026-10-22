import {
  DISCORD_TEXT_BUDGET_DEFAULT,
  DISCORD_V2_FLAG,
  type DiscordComponent,
  type DiscordContainer,
  type DiscordMediaGallery,
  type DiscordSection,
  type DiscordSeparator,
  type DiscordTextDisplay,
  type DiscordThumbnail,
  type DiscordWebhookPayload,
  type PushNotificationInput,
  type PushNotificationMod,
} from './types';
import { isHttpsUrl, sanitizeName, sanitizeText } from './sanitize';

const BULLET = '•';

function truncateLines(lines: string[], budget: number): { lines: string[]; more: number } {
  const out: string[] = [];
  let used = 0;
  let more = 0;
  for (const line of lines) {
    const cost = line.length + 1;
    if (used + cost <= budget) {
      out.push(line);
      used += cost;
    } else {
      more++;
    }
  }
  // account for "+N more" line
  if (more > 0) {
    const moreLine = `+${more} more`;
    if (used + moreLine.length + 1 <= budget) {
      out.push(moreLine);
    } else {
      // drop last to fit
      while (out.length > 0 && used + moreLine.length + 1 > budget) {
        const last = out.pop()!;
        used -= last.length + 1;
      }
      if (out.length > 0) out.push(moreLine);
    }
  }
  return { lines: out, more: 0 };
}

function modLine(m: PushNotificationMod, showTransition: boolean): string {
  const name = sanitizeName(m.name || 'unknown', 60);
  if (showTransition && m.oldVersion && m.version) {
    return `${BULLET} ${name} \`${sanitizeText(m.oldVersion, 20)} → ${sanitizeText(m.version, 20)}\``;
  }
  if (m.version) return `${BULLET} ${name} \`${sanitizeText(m.version, 20)}\``;
  return `${BULLET} ${name}`;
}

function buildStatusDisplay(
  title: string,
  mods: PushNotificationMod[],
  transition: boolean,
  budget: number,
): DiscordTextDisplay | null {
  if (mods.length === 0) return null;
  const header = `**${title}** (${mods.length})`;
  const lines = mods.map(m => modLine(m, transition));
  const { lines: kept } = truncateLines(lines, budget - header.length - 2);
  const content = kept.length > 0 ? `${header}\n${kept.join('\n')}` : header;
  return { type: 10, content };
}

export function buildPushNotification(input: PushNotificationInput): DiscordWebhookPayload {
  const budget = input.textBudget ?? DISCORD_TEXT_BUDGET_DEFAULT;
  const added = input.added ?? [];
  const updated = input.updated ?? [];
  const removed = input.removed ?? [];
  const changedFiles = input.changedFiles ?? [];

  const containerComponents: DiscordComponent[] = [];

  // Header section
  const headerLines: string[] = [];
  const modpack = sanitizeName(input.modpackName || 'Modpack', 80);
  headerLines.push(`# ${modpack} — v${sanitizeText(input.version, 40)}`);
  const sub: string[] = [];
  if (input.author) sub.push(sanitizeText(input.author, 40));
  if (input.timestamp) sub.push(`<t:${Math.floor(input.timestamp)}:f>`);
  if (sub.length) headerLines.push(sub.join(' • '));
  const headerContent = headerLines.join('\n');

  if (input.modpackIconUrl && isHttpsUrl(input.modpackIconUrl)) {
    const headerSection: DiscordSection = {
      type: 9,
      components: [{ type: 10, content: headerContent }],
      accessory: { type: 11, media: { url: input.modpackIconUrl }, description: modpack },
    };
    containerComponents.push(headerSection);
  } else {
    containerComponents.push({ type: 10, content: headerContent });
  }

  // Summary
  const summaryParts: string[] = [];
  summaryParts.push(`Added: **${added.length}**`);
  summaryParts.push(`Updated: **${updated.length}**`);
  summaryParts.push(`Removed: **${removed.length}**`);
  if (changedFiles.length > 0) summaryParts.push(`Files: **${changedFiles.length}**`);
  const summaryDisplay: DiscordTextDisplay = { type: 10, content: summaryParts.join('  •  ') };
  containerComponents.push(summaryDisplay);

  containerComponents.push({ type: 14, divider: true, spacing: 1 });

  // Per-status sections
  const statusBudget = Math.floor(budget * 0.55);
  const perStatusBudget = Math.floor(statusBudget / 3);
  const addedDisplay = buildStatusDisplay('✅ Added', added, false, perStatusBudget);
  if (addedDisplay) containerComponents.push(addedDisplay);
  const updatedDisplay = buildStatusDisplay('🔄 Updated', updated, true, perStatusBudget);
  if (updatedDisplay) containerComponents.push(updatedDisplay);
  const removedDisplay = buildStatusDisplay('❌ Removed', removed, false, perStatusBudget);
  if (removedDisplay) containerComponents.push(removedDisplay);

  // Changed files
  if (changedFiles.length > 0) {
    containerComponents.push({ type: 14, divider: true, spacing: 1 });
    const fileList = changedFiles.slice(0, 12).map(f => `\`${sanitizeText(f, 80)}\``);
    const more = changedFiles.length - fileList.length;
    if (more > 0) fileList.push(`+${more} more`);
    containerComponents.push({ type: 10, content: `**📁 Changed Files**\n${fileList.join('\n')}` });
  }

  // Media gallery (optional, only https)
  const icons = (input.modIcons ?? []).filter(isHttpsUrl).slice(0, 10);
  if (icons.length > 0) {
    const gallery: DiscordMediaGallery = {
      type: 12,
      items: icons.map(u => ({ media: { url: u } })),
    };
    containerComponents.push(gallery);
  }

  // Footer
  const footerLines: string[] = [];
  const footerParts: string[] = [];
  if (input.commitShort) footerParts.push(`commit \`${sanitizeText(input.commitShort, 12)}\``);
  if (input.appVersion) footerParts.push(`app ${sanitizeText(input.appVersion, 20)}`);
  if (footerParts.length) footerLines.push(`-# ${footerParts.join(' • ')}`);
  // mentions as markdown in a text display (content unavailable under V2)
  const mentions: string[] = [];
  for (const r of input.maintainerRoleIds ?? []) mentions.push(`<@&${r}>`);
  for (const u of input.maintainerUserIds ?? []) mentions.push(`<@${u}>`);
  if (mentions.length) {
    containerComponents.push({ type: 10, content: mentions.join(' ') });
  }
  if (footerLines.length) containerComponents.push({ type: 10, content: footerLines.join('\n') });

  // Wrap in container
  const container: DiscordContainer = {
    type: 17,
    components: containerComponents,
    accent_color: input.accentColor ?? 5814783,
  };

  // Total text display budget check: if exceeds, truncate summary? We'll leave as is; validator enforces.

  const allowed_mentions: DiscordWebhookPayload['allowed_mentions'] = {
    parse: [],
  };
  if (input.maintainerRoleIds?.length) allowed_mentions.roles = [...input.maintainerRoleIds];
  if (input.maintainerUserIds?.length) allowed_mentions.users = [...input.maintainerUserIds];

  return {
    flags: DISCORD_V2_FLAG,
    components: [container],
    allowed_mentions,
  };
}
