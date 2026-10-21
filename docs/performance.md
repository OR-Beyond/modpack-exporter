# Performance

Last verified against commit HEAD.

## Budgets
Startup to first paint, TTI, page navigation, 1500-mod list render. See scripts/bench/ (to be added).

## Rules
- Reserve space for icons (width/height/aspect-ratio), loading="lazy", decoding="async".
- Key lists by stable ids.
- Apply theme before first paint.
- Batch IPC.

## Measurement
Run scripts/bench/* and record before/after in .agent/PROGRESS.md.
