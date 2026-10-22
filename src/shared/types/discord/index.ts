export const DISCORD_V2_FLAG = 1 << 15;
export type DiscordComponent =
  | { type: 10; content: string; id?: number }
  | { type: 11; media: { url: string }; description?: string; id?: number }
  | { type: 9; components: { type: 10; content: string; id?: number }[]; accessory?: { type: 11; media: { url: string }; description?: string; id?: number }; id?: number }
  | { type: 12; items: { media: { url: string }; description?: string }[]; id?: number }
  | { type: 14; divider?: boolean; spacing?: 1 | 2; id?: number }
  | { type: 17; components: DiscordComponent[]; accent_color?: number; spoiler?: boolean; id?: number }
  | { type: 1; components: { type: 2; style: 5; label: string; url: string; id?: number }[]; id?: number };

export interface DiscordWebhookPayload {
  flags: number;
  components: DiscordComponent[];
  allowed_mentions?: { parse: string[]; roles?: string[]; users?: string[] };
  username?: string;
  avatar_url?: string;
  content?: never;
  embeds?: never;
}
