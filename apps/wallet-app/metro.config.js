// Expo's metro config: required so `expo export:embed` (which now produces the
// release bundle + the embedded expo-updates manifest) and the dev server agree
// on resolution. Still a plain Metro config, so `react-native start` works too.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Packages are hoisted to the repo root, and the shared Convex API lives there.
config.watchFolders = [
  path.resolve(monorepoRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'convex'),
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
