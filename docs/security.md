# Security

Last verified against commit 03d77bc.

## Checklist
- BrowserWindow: contextIsolation true, nodeIntegration false, sandbox true where possible, webSecurity on, strict CSP, navigation/window.open denied by default.
- IPC: validate payload + sender; preload minimal typed API.
- shell.openExternal/openPath: validated https URLs / paths only.
- Filesystem: path traversal + zip-slip protection on remote-derived paths.
- Credentials: GitHub tokens stored via safeStorage, migrated from plaintext electron-store; never logged.
- Network: timeouts, AbortController, retry/backoff, schema validation, SHA verification.
