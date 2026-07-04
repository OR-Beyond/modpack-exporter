# ORB Modpack Exporter

A desktop collaboration tool that lets Minecraft modpack developers sync mods, export releases, and manage team contributions — without needing Git, command-line tools, or technical knowledge.

Built for the [Origin Realms Beyond (ORB)](https://modrinth.com/modpack/origin-realms-beyond) community modpack.

---

## How It Works

1. **Download** the latest installer for your platform from [GitHub Releases](https://github.com/OR-Beyond/modpack-exporter/releases)
2. **Log in** with your GitHub account (must be a member of the OR-Beyond organization)
3. **Select your Modrinth profile** — the app auto-detects installed profiles
4. **Add or remove mods** in your mods folder, edit configs, drop resource packs
5. **Click Push** — the app scans your changes, builds a manifest, and syncs everything to the team
6. **Auto-sync on launch** — the app pulls the latest changes when you open it
7. **Export .mrpack** — generate Modrinth-compatible modpack files with auto-generated changelogs

---

## Features

- **Professional desktop installers** — Windows NSIS/MSI, Linux AppImage/DEB/RPM, and macOS DMG/ZIP/PKG builds
- **Hybrid storage** — mod `.jar` files are referenced via Modrinth CDN (manifest only), override files (configs, resource packs, shader packs) are synced via Git
- **Smart merge** — locally-added mods are preserved during auto-sync, never deleted
- **Push preview** — see exactly what will change before committing
- **Pull popup** — after syncing, see mods added/updated/removed with icons from Modrinth
- **Discord notifications** — maintainers get pinged with a rich embed on every push
- **Editable changelogs** — export generates a changelog diffed against your last Modrinth release; edit it before publishing
- **Undo last push** — one-click revert if someone pushes the wrong thing
- **Version tracking** — reads the latest published version from Modrinth API, suggests the next bump
- **Auto-update** — checks GitHub Releases on launch, downloads updates in the background, and installs on restart

---

## Requirements

- **Windows** (macOS/Linux packages are produced by the release workflow)
- A GitHub account with access to the [OR-Beyond organization](https://github.com/OR-Beyond)
- Modrinth App installed with a development modpack profile

---

## For Contributors

### First-time setup

1. Download the latest Windows installer (`.exe`, preferred) from [Releases](https://github.com/OR-Beyond/modpack-exporter/releases)
2. Run the installer and choose the installation directory if needed
3. Launch **ORB Modpack Exporter**
4. Log in with GitHub when prompted
5. Select your Modrinth profile in Settings
6. Done — the app auto-syncs the current modpack on launch

### Daily workflow

- **Add a mod:** drop the `.jar` into your `mods/` folder → open the app → click Push
- **Update a mod:** replace the old `.jar` → open the app → push preview shows the change → Push
- **Remove a mod:** delete the `.jar` → open the app → push preview confirms → Push
- **Get latest changes:** click Pull Latest (or auto-sync on launch)

### Important

- Always open the app **before** making changes. If you add mods while the app is closed, auto-sync on launch will preserve them (smart merge), but it's best practice to push your changes first.
- Personal files (`options.txt`, `keybindings.txt`, `servers.dat`) are never synced.
- Use the Default Options mod (`/defaultoptions saveAll` in-game) to set modpack defaults.

---

## Architecture

| Component | Technology |
|-----------|-----------|
| Desktop app | Electron + React + TypeScript |
| UI | Tailwind CSS (dark theme) |
| Git operations | `isomorphic-git` (pure JS, no system Git required) |
| Modrinth API | Direct fetch for mod resolution, hashing, and caching |
| GitHub integration | Octokit (OAuth device flow) |
| Build system | Vite + Electron Forge dev server |
| Packaging | Electron Builder |
| Auto-update | electron-updater via GitHub Releases |
| State storage | `electron-store` |

### Storage model

- **Mod `.jar` files** → stored in `modrinth.index.json` manifest (downloaded from Modrinth CDN on pull)
- **Override files** (configs, resource packs, shader packs, scripts) → synced via Git in a versions repo
- **Personal files** (keybinds, UI settings) → excluded from sync

---

## Related Repos

- [OR-Beyond/OR-Beyond-Versions](https://github.com/OR-Beyond/OR-Beyond-Versions) — Modpack manifest and override storage
- [Origin Realms Beyond on Modrinth](https://modrinth.com/modpack/origin-realms-beyond) — Public modpack page

---

## Code Signing

This project uses [SignPath Foundation](https://signpath.org/) for free open-source code signing. Windows release artifacts are submitted to SignPath from GitHub Actions when the SignPath secrets are configured:

- `SIGNPATH_API_TOKEN`
- `SIGNPATH_ORGANIZATION_ID`
- `SIGNPATH_PROJECT_SLUG`
- `SIGNPATH_SIGNING_POLICY_SLUG`
- `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG` (optional; defaults to `default`)

The release workflow preserves signing as a conditional step so unsigned local builds remain possible, while official tagged Windows releases can be signed by SignPath.

## Development

```bash
npm install
npm run dev
```

## Build and Release

```bash
npm run build      # Build main, preload, and renderer bundles
npm run package    # Create an unpacked local app
npm run dist       # Build platform installers locally
npm run release    # Build and publish with electron-builder
```

Official releases are created from Git tags:

```bash
git tag v2.0.6
git push origin v2.0.6
```

The GitHub Actions workflow builds Windows, Linux, and macOS installers, creates or updates the GitHub Release, uploads all artifacts, and publishes update metadata consumed by `electron-updater`.

---

## License

MIT
