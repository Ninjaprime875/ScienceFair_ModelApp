const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = [...config.resolver.assetExts, "bin"];

config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  "jsx",
  "js",
  "ts",
  "tsx",
];

config.resolver.blacklistRE =
  /.*\/node_modules\/@tensorflow\/tfjs-react-native\/dist\/camera\/.*/;

module.exports = config;
