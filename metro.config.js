const path = require('path');
const { getDefaultConfig: rnGetDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { getDefaultConfig: expoGetDefaultConfig } = require('@expo/metro-config');

const expoBase = expoGetDefaultConfig(__dirname);
const rnBase = rnGetDefaultConfig(__dirname);

const defaultBlockList = [
  /.*[/\\]android[/\\]build[/\\]\.*/,
  /.*[/\\]\.react-native-.*[/\\]\.*/,
  /.*[/\\]build[/\\]generated[/\\]\.*/,
  /.*[/\\]\.next[/\\]\.*/,
  /.*[/\\]apps[/\\][^/\\]+[/\\]\.next[/\\]\.*/,
  /.*[/\\]apps[/\\][^/\\]+[/\\]out[/\\]\.*/,
];

const config = {
  ...expoBase,
  ...rnBase,
  watchFolders: [path.resolve(__dirname, 'packages'), ...(expoBase.watchFolders || [])],
  resolver: {
    ...expoBase.resolver,
    ...rnBase.resolver,
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules'), ...(expoBase.resolver?.nodeModulesPaths || [])],
    blockList: [...defaultBlockList],
  },
  transformer: {
    ...expoBase.transformer,
    ...rnBase.transformer,
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  serializer: expoBase.serializer || rnBase.serializer,
};

module.exports = config;
