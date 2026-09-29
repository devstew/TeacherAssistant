// Metro у монорепо: ядро підключене як сирці, тож збирач має бачити весь репозиторій
// і шукати модулі в кореневому node_modules, куди npm workspaces усе піднімає.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Інакше Metro підіймається вище кореня репозиторію й може взяти чужу копію React.
config.resolver.disableHierarchicalLookup = true;
// Веб-версія SQLite (лише для перегляду в браузері) тягне .wasm як ресурс.
config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];

module.exports = config;
