# Security

Last verified against commit 03d77bc.

## Checklist
- BrowserWindow: contextIsolation true, nodeIntegration false, sandbox true where possible, webSecurity on, strict CSP, navigation/window.open denied by default.
- IPC: validate payload + sender; preload minimal typed API.
- shell.openExternal/openPath: validated https URLs / paths only.
- Filesystem: path traversal + zip-slip protection on remote-derived paths.
- Credentials: GitHub tokens stored via safeStorage, migrated from plaintext electron-store; never logged.
- Network: timeouts, AbortController, retry/backoff, schema validation, SHA verification.

## Secret policy
- Never commit webhook URLs, tokens, OAuth credentials or CI secrets.
- Secrets are supplied via safeStorage (app) or environment variables (scripts).
- `bun run secret-scan` must be green; it runs in the gate.
- The legacy hardcoded Discord webhook is considered compromised (it lived in
  public history). The owner must delete or rotate it in Discord.
