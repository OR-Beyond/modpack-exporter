const fs = require('fs');
const path = require('path');

const extraResources = [
  { from: 'core.py', to: 'core.py' },
  { from: 'export_runner.py', to: 'export_runner.py' },
  { from: 'sync_mods.py', to: 'sync_mods.py' },
  { from: 'config.yaml', to: 'config.yaml' },
  { from: 'build/icons/256x256.png', to: 'icon.png' },
];

const portableGitDir = path.join(__dirname, 'portable-git');
if (fs.existsSync(portableGitDir)) {
  extraResources.push({ from: 'portable-git', to: 'portable-git' });
}

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'org.orbeyond.modpackexporter',
  productName: 'ORB Modpack Exporter',
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
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
      owner: 'OR-Beyond',
      repo: 'modpack-exporter',
      releaseType: 'release',
    },
  ],
  win: {
    icon: 'build/icons/icon.ico',
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'msi', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] },
    ],
    executableName: 'orb-modpack-exporter',
    requestedExecutionLevel: 'asInvoker',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'ORB Modpack Exporter',
    uninstallDisplayName: 'ORB Modpack Exporter',
    deleteAppDataOnUninstall: false,
  },
  msi: {
    oneClick: false,
    perMachine: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'ORB Modpack Exporter',
  },
  linux: {
    icon: 'build/icons',
    category: 'Utility',
    maintainer: 'ORB Team',
    synopsis: 'Minecraft modpack collaboration and export tool',
    syncDesktopName: true,
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb', arch: ['x64'] },
      { target: 'rpm', arch: ['x64'] },
    ],
  },
  deb: {
    depends: [
      'libgtk-3-0',
      'libnotify4',
      'libnss3',
      'libxss1',
      'libxtst6',
      'xdg-utils',
    ],
  },
  mac: {
    icon: 'build/icons/icon.icns',
    category: 'public.app-category.developer-tools',
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] },
      { target: 'zip', arch: ['x64', 'arm64'] },
      { target: 'pkg', arch: ['x64', 'arm64'] },
    ],
    hardenedRuntime: true,
    gatekeeperAssess: false,
  },
  dmg: {
    sign: false,
  },
};
