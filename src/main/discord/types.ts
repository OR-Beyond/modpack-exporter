export const DISCORD_V2_FLAG = 1 << 15; // 32768
export const DISCORD_TEXT_BUDGET_DEFAULT = 3500;

export interface DiscordTextDisplay {
  type: 10;
  content: string;
  id?: number;
}

export interface DiscordThumbnail {
  type: 11;
  media: { url: string };
  description?: string;
  id?: number;
}

export interface DiscordSection {
  type: 9;
  components: DiscordTextDisplay[];
  accessory?: DiscordThumbnail;
  id?: number;
}

export interface DiscordMediaGalleryItem {
  media: { url: string };
  description?: string;
}

export interface DiscordMediaGallery {
  type: 12;
  items: DiscordMediaGalleryItem[];
  id?: number;
}

export interface DiscordSeparator {
  type: 14;
  divider?: boolean;
  spacing?: 1 | 2;
  id?: number;
}

export interface DiscordContainer {
  type: 17;
  components: DiscordComponent[];
  accent_color?: number;
  spoiler?: boolean;
  id?: number;
}

export type DiscordComponent =
  | DiscordTextDisplay
  | DiscordSection
  | DiscordMediaGallery
  | DiscordSeparator
  | DiscordContainer
  | { type: 1; components: { type: 2; style: 5; label: string; url: string; id?: number; custom_id?: string }[]; id?: number };

export interface DiscordWebhookPayload {
  flags: number;
  components: DiscordComponent[];
  allowed_mentions?: { parse: string[]; roles?: string[]; users?: string[] };
  username?: string;
  avatar_url?: string;
}

export interface PushNotificationMod {
  name: string;
  version?: string | null;
  oldVersion?: string | null;
}

export interface PushNotificationInput {
  modpackName?: string;
  version: string;
  commitShort?: string;
  author?: string;
  timestamp?: number;
  appVersion?: string;
  added?: PushNotificationMod[];
  updated?: PushNotificationMod[];
  removed?: PushNotificationMod[];
  changedFiles?: string[];
  maintainerRoleIds?: string[];
  maintainerUserIds?: string[];
  modpackIconUrl?: string | null;
  modIcons?: string[];
  textBudget?: number;
  accentColor?: number;
  useLinkButtons?: boolean;
}
