module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-code-push|code-push|react-native-safe-area-context|react-native-image-picker|convex|@convex-dev|is-network-error|@react-navigation|react-native-vector-icons|react-native-google-mobile-ads)/)',
  ],
};
