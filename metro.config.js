const path = require('path');
const { getDefaultConfig } = require('@expo/metro-config');

const base = getDefaultConfig(__dirname);

const config = {
  ...base,
  watchFolders: [path.resolve(__dirname, 'packages'), ...(base.watchFolders || [])],
  resolver: {
    ...base.resolver,
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
    ...base.transformer,
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = config;
