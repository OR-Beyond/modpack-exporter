# Discord notifications

Last verified against commit HEAD.

## Message format
Push success sends a Components V2 message: `flags = 32768`
(`IS_COMPONENTS_V2`), `components` array containing a Container with Text
Display / Section / Separator / (optional) Media Gallery. No `content` or
`embeds`. POST URL includes `?with_components=true&wait=true`.

## Invariants
- Webhook URL is never logged (redacted host/ID only).
- Non-interactive components only (no custom_id buttons). Link buttons
  (style 5) are behind `DISCORD_USE_LINK_BUTTONS` (default false).
- Total Text Display content <= 3500 chars (conservative budget).
- Total components <= 40 (including nested).
- Mentions use `allowed_mentions` restricted to configured role/user ids.

## Payload layer
`src/main/discord/payload.ts` exports `buildPushNotification(input)`.
`src/main/discord/validate.ts` exports `validateWebhookV2Payload(payload)`
returning a violation list (empty = valid). Every payload must pass validation
before sending.

## Scripts
- `scripts/discord/validate-payload.ts` — validate a payload JSON offline.
- `scripts/discord/preview-payload.ts` — local HTML preview.
- `scripts/discord/send-test.ts` — prints payload by default; sends only with
  `--execute` and a TEST webhook env var.

## Fallback
On HTTP 4xx validation error, one degraded legacy-embed message is sent so
maintainers still get notified. Discord failures never fail or roll back the push.
