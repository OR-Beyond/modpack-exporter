# Releasing

Last verified against commit 03d77bc.

## Artifacts
- Windows: `*-setup-*.exe` (NSIS installer, auto-update enabled) and `*-portable-*.exe` (no updater).
- Linux: AppImage, DEB, RPM.
- macOS: DMG, ZIP (ZIP required for auto-update).

## Workflow
Tag `v*` triggers `.github/workflows/release.yml`: verify version → matrix build (`--publish never`) → single release job uploads all artifacts + metadata.

## Signing order (critical)
SignPath must sign BOTH installer and portable BEFORE `latest.yml` hashes are finalized, otherwise checksum verification fails. Configure signing so the signed bytes are what electron-builder hashes, or regenerate `latest.yml` after signing.

## Manual verification
- updater end-to-end requires a real published release.
- Portable must never initialize the updater (checks `PORTABLE_EXECUTABLE_FILE`).
