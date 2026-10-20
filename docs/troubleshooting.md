# Troubleshooting

Last verified against commit 03d77bc.

## Common issues
- Auto-sync cross-profile: ensure profile identity passed; check identity guard logs.
- Portable tries to update: check `PORTABLE_EXECUTABLE_FILE` env detection.
- Update checksum mismatch: signing happened after `latest.yml` generation.
- Missing modules in packaged build: ensure deps bundled in main (not externalized).
