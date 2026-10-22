import {
  DISCORD_V2_FLAG,
  type DiscordComponent,
  DISCORD_TEXT_BUDGET_DEFAULT,
} from './types';

const MAX_COMPONENTS = 40;
const MAX_BUTTON_LABEL = 80;
const MAX_LINK_URL = 512;
const MAX_THUMB_DESC = 1024;
const MAX_MEDIA_GALLERY = 10;
const MAX_SECTION_CHILDREN = 3;

function isHttps(s: string): boolean {
  try { return new URL(s).protocol === 'https:'; } catch { return false; }
}

export class WebhookV2ViolationList extends Array<string> {
  get valid(): boolean { return this.length === 0; }
}

export function getWebhookV2Violations(payload: any): string[] {
  const out: string[] = [];
  if (!payload || typeof payload !== 'object') { out.push('payload must be an object'); return out; }
  if (payload.flags !== DISCORD_V2_FLAG) out.push('flags must be IS_COMPONENTS_V2 (32768)');
  if (payload.content !== undefined) out.push('content is not allowed under V2');
  if (Array.isArray(payload.embeds) && payload.embeds.length > 0) out.push('embeds are not allowed under V2');
  if (payload.poll !== undefined) out.push('poll is not allowed under V2');
  if (payload.stickers !== undefined) out.push('stickers are not allowed under V2');
  if (!Array.isArray(payload.components)) { out.push('components must be an array'); return out; }

  const allIds = new Set<number>();
  let totalComponents = 0;
  let totalText = 0;
  const countComponents = (c: DiscordComponent): number => {
    totalComponents++;
    if (c.type === 17) {
      let n = 1;
      for (const ch of (c as any).components ?? []) n += countComponents(ch);
      return n;
    }
    if (c.type === 9) {
      for (const ch of (c as any).components ?? []) countComponents(ch);
      if ((c as any).accessory) countComponents((c as any).accessory);
      return 1;
    }
    if (c.type === 1) {
      for (const b of (c as any).components ?? []) { totalComponents++; }
      return 1;
    }
    return 1;
  };

  const validateComponent = (c: any, path: string, topLevel: boolean) => {
    if (!c || typeof c !== 'object') { out.push(`${path}: must be object`); return; }
    totalComponents++;
    switch (c.type) {
      case 10: { // Text Display
        if (typeof c.content !== 'string') out.push(`${path}: text display content must be string`);
        else {
          totalText += c.content.length;
        }
        break;
      }
      case 11: { // Thumbnail
        if (!c.media || typeof c.media.url !== 'string' || !isHttps(c.media.url)) out.push(`${path}: thumbnail media.url must be https`);
        if (c.description !== undefined && (typeof c.description !== 'string' || c.description.length > MAX_THUMB_DESC)) out.push(`${path}: thumbnail description invalid/long`);
        break;
      }
      case 9: { // Section
        if (!Array.isArray(c.components) || c.components.length < 1 || c.components.length > MAX_SECTION_CHILDREN) out.push(`${path}: section must have 1-3 text displays`);
        for (const [i, ch] of (c.components ?? []).entries()) {
          if (ch?.type !== 10) out.push(`${path}.components[${i}]: must be text display`);
          else validateComponent(ch, `${path}.components[${i}]`, false);
        }
        if (c.accessory !== undefined) {
          if (c.accessory?.type !== 11) out.push(`${path}.accessory: must be thumbnail`);
          else validateComponent(c.accessory, `${path}.accessory`, false);
        }
        break;
      }
      case 12: { // Media Gallery
        if (!Array.isArray(c.items) || c.items.length < 1 || c.items.length > MAX_MEDIA_GALLERY) out.push(`${path}: media gallery must have 1-10 items`);
        for (const [i, it] of (c.items ?? []).entries()) {
          if (!it?.media || typeof it.media.url !== 'string' || !isHttps(it.media.url)) out.push(`${path}.items[${i}].media.url must be https`);
        }
        break;
      }
      case 14: { // Separator
        if (c.divider !== undefined && typeof c.divider !== 'boolean') out.push(`${path}: separator divider must be boolean`);
        if (c.spacing !== undefined && c.spacing !== 1 && c.spacing !== 2) out.push(`${path}: separator spacing must be 1 or 2`);
        break;
      }
      case 17: { // Container
        if (!Array.isArray(c.components) || c.components.length === 0) out.push(`${path}: container must have children`);
        for (const [i, ch] of (c.components ?? []).entries()) validateComponent(ch, `${path}.components[${i}]`, false);
        if (c.accent_color !== undefined && (typeof c.accent_color !== 'number' || c.accent_color < 0 || c.accent_color > 0xffffff)) out.push(`${path}: accent_color out of range`);
        if (c.spoiler !== undefined && typeof c.spoiler !== 'boolean') out.push(`${path}: spoiler must be boolean`);
        break;
      }
      case 1: { // Action Row
        if (!Array.isArray(c.components) || c.components.length < 1 || c.components.length > 5) out.push(`${path}: action row must have 1-5 buttons`);
        for (const [i, b] of (c.components ?? []).entries()) {
          totalComponents++;
          if (b?.type !== 2) { out.push(`${path}.components[${i}]: must be button`); continue; }
          if (b.style !== 5) out.push(`${path}.components[${i}]: only link buttons (style 5) allowed`);
          if (typeof b.label !== 'string' || b.label.length === 0 || b.label.length > MAX_BUTTON_LABEL) out.push(`${path}.components[${i}]: button label invalid`);
          if (typeof b.url !== 'string' || !isHttps(b.url) || b.url.length > MAX_LINK_URL) out.push(`${path}.components[${i}]: button url invalid`);
          if (b.custom_id !== undefined) out.push(`${path}.components[${i}]: custom_id not allowed (interactive)`);
        }
        break;
      }
      default:
        out.push(`${path}: unknown component type ${c.type}`);
    }

    // id uniqueness
    if (typeof c.id === 'number') {
      if (allIds.has(c.id)) out.push(`${path}: duplicate id ${c.id}`);
      else allIds.add(c.id);
    }

    // File components forbidden
    if (c.type === 13) out.push(`${path}: file components are not allowed`);

    // Top-level restriction
    if (topLevel) {
      const allowedTop = [17, 9, 10, 12, 14, 1];
      if (!allowedTop.includes(c.type)) out.push(`${path}: component type ${c.type} not allowed at top level`);
    }
  };

  for (const [i, c] of payload.components.entries()) {
    validateComponent(c, `components[${i}]`, true);
  }

  // component count (recursive count already incremented in validateComponent for each node)
  if (totalComponents > MAX_COMPONENTS) out.push(`total components ${totalComponents} exceeds ${MAX_COMPONENTS}`);

  // text budget
  const effectiveBudget = DISCORD_TEXT_BUDGET_DEFAULT;
  if (totalText > effectiveBudget) out.push(`total text display content ${totalText} exceeds ${effectiveBudget}`);

  // thumbnail only as section accessory check already.

  // allowed_mentions
  if (payload.allowed_mentions !== undefined) {
    if (typeof payload.allowed_mentions !== 'object' || payload.allowed_mentions === null) out.push('allowed_mentions must be object');
    else if (!Array.isArray(payload.allowed_mentions.parse)) out.push('allowed_mentions.parse must be array');
  }

  // Section child type already validated.

  // Action row top-level allowed? yes if link buttons enabled; validator allows.

  return out;
}

export function validateWebhookV2Payload(payload: any): WebhookV2ViolationList {
  const list = new WebhookV2ViolationList();
  const v = getWebhookV2Violations(payload);
  for (const x of v) list.push(x);
  return list;
}
