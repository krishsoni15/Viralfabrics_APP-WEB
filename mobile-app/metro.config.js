const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add support for modern ES modules and package exports
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];
config.resolver.unstable_enablePackageExports = true;

const path = require('path');
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Exclude native build and cache directories from Metro file watching to prevent ENOSPC system watcher limit errors
config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  new RegExp(escapeRegExp(path.join(__dirname, 'android')) + '/.*'),
  new RegExp(escapeRegExp(path.join(__dirname, 'ios')) + '/.*'),
  new RegExp(escapeRegExp(path.join(__dirname, 'build')) + '/.*'),
  /.*\/node_modules\/(?:@[^\/]+\/)?[^\/]+\/android\/.*/,
  /.*\/node_modules\/(?:@[^\/]+\/)?[^\/]+\/ios\/.*/,
];

// No resolver override needed

module.exports = config;
