const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

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
