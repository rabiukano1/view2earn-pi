module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-code-push|code-push|react-native-safe-area-context|react-native-image-picker)/)',
  ],
};
