const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { getBundleModeMetroConfig } = require("react-native-worklets/bundleMode");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(
  getBundleModeMetroConfig(config),
  { input: "./src/global.css" }
);
