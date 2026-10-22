# Shared types

Last verified against commit HEAD.

## Location
All cross-module types live in `src/shared/types/<system>/` with one subfolder
per system (discord, ipc, errors, ...). Each subfolder has an `index.ts`
re-exporting only its public types. Renderer-only prop types stay with the
component.

## Rules
- Any type crossing a module boundary lives here.
- No type declared twice; merge duplicates.
- Runtime constants/enums live in `src/shared/constants/`, not types.
- Use `import type` everywhere.
