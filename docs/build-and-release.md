# Build and release

Last verified against commit HEAD.

## Artifacts
Windows setup (auto-update) + portable (no updater). Linux AppImage/deb/rpm. macOS dmg/zip.

## Workflow triggers
Tag push v* → release.yml (verify → matrix build → publish). workflow_dispatch supported.

## Rebuild without deleting release
Use rebuild-release.yml (workflow_dispatch) with tag, platforms, mode. Or scripts/release/rebuild.ts (dry-run default).

## Scripts
release:prepare, release:tag, release:rebuild, release:retag, release:status. All default to dry-run; --execute required to act.
