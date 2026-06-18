const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude Gradle Kotlin compiler build and caching directories from the Metro file watcher
config.resolver.blockList = [
  /node_modules\/.*\/build\/kotlin\/.*/,
  /node_modules\/.*\/compileKotlin\/.*/,
  /node_modules\/expo-updates\/.*\/caches-jvm.*/,
  /.*\/build\/kotlin\/compileKotlin\/.*/
];

module.exports = config;
