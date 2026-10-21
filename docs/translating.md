# Translating the app

Last verified against commit HEAD.

## How to add a language
1. Run `bun run i18n:new <code>` (e.g. de, ru, pt-BR).
2. Edit src/renderer/locales/<code>.lang: translate values, keep keys.
3. Run `bun run i18n:check` and `bun run i18n:stats`.
4. Test by selecting the language in Settings.
5. Open a PR. No code changes required.

## Format
Metadata header fields: @locale, @nativeName, @englishName, @direction, @translators, @reviewed. Then key = value lines. Placeholders {name}. Plurals: {count, plural, one {...} other {...}}.

## Never translate
Product/proper names: Modrinth, GitHub, Discord, Git, .mrpack. Git commit messages, Discord embeds, changelogs, modrinth.index.json, logs.
