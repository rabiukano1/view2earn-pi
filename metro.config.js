const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// Monorepo: @view2earn/core is a workspace package symlinked into node_modules.
// Watch packages/ so Metro bundles its source through the symlink, and pin the
// root node_modules so its deps resolve.
const config = {
  watchFolders: [path.resolve(__dirname, 'packages')],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    blockList: [
      /.*[/\\]android[/\\]build[/\\]\.*/,
      /.*[/\\]\.react-native-.*[/\\]\.*/,
      /.*[/\\]build[/\\]generated[/\\]\.*/,
      /.*[/\\]\.next[/\\]\.*/,
      /.*[/\\]apps[/\\][^/\\]+[/\\]\.next[/\\]\.*/,
      /.*[/\\]apps[/\\][^/\\]+[/\\]out[/\\]\.*/,
    ],
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
