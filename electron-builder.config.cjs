const extraResources = [
  { from: 'config.yaml', to: 'config.yaml' },
  { from: 'build/icons/256x256.png', to: 'icon.png' },
];

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'org.orbeyond.modpackexporter',
  productName: 'ORB Modpack Exporter',
  artifactName: 'ORB-Modpack-Exporter-${version}-${os}-${arch}.${ext}',
  copyright: 'Copyright © ${author}',
  asar: true,
  directories: {
    buildResources: 'build',
    output: 'dist',
  },
  files: [
    '.vite/**/*',
    'package.json',
  ],
  extraResources,
  publish: [
    {
      provider: 'github',
      owner: process.env.GH_OWNER || 'OR-Beyond',
      repo: process.env.GH_REPO || 'modpack-exporter',
      releaseType: 'release',
    },
  ],

  // ── Windows ───────────────────────────────────────────────────────────────
  win: {
    icon: 'build/icons/icon.ico',
    target: [
      { target: 'nsis', arch: ['x64', 'arm64'] },
      { target: 'portable', arch: ['x64', 'arm64'] },
    ],
    executableName: 'orb-modpack-exporter',
    requestedExecutionLevel: 'asInvoker',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'ORB Modpack Exporter',
    uninstallDisplayName: 'ORB Modpack Exporter',
    deleteAppDataOnUninstall: false,
    artifactName: 'ORB-Modpack-Exporter-${version}-setup-${arch}.${ext}',
  },
  portable: {
    artifactName: 'ORB-Modpack-Exporter-${version}-portable-${arch}.${ext}',
  },

  // ── macOS ──────────────────────────────────────────────────────────────────
  mac: {
    icon: 'build/icons/icon.icns',
    category: 'public.app-category.developer-tools',
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] },
      { target: 'zip', arch: ['x64', 'arm64'] },
    ],
    hardenedRuntime: true,
    gatekeeperAssess: false,
    // Set identity to null for ad-hoc signing; for production, use a real
    // Apple Developer ID certificate to avoid quarantine on first launch:
    //   identity: 'Developer ID Application: Your Name (TEAMID)'
    identity: null,
  },
  dmg: {
    sign: false,
    artifactName: '${productName}-${version}-mac-${arch}.dmg',
  },
  afterPack: null,

  // ── Linux ──────────────────────────────────────────────────────────────────
  linux: {
    icon: 'build/icons/1024x1024.png',
    category: 'Utility',
    maintainer: 'ORB Team',
    synopsis: 'Minecraft modpack collaboration and export tool',
    description: 'A desktop collaboration tool that lets Minecraft modpack developers sync mods, export releases, and manage team contributions.',
    target: [
      { target: 'AppImage', arch: ['x64', 'arm64'] },
      { target: 'deb', arch: ['x64', 'arm64'] },
      { target: 'rpm', arch: ['x64', 'arm64'] },
    ],
  },
  appImage: {
    artifactName: '${productName}-${version}-linux-x86_64.AppImage',
    synopsis: 'ORB Modpack Exporter',
    description: 'Minecraft modpack collaboration tool',
    category: 'Utility',
  },
};
