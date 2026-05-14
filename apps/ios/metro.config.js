const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so Metro can resolve shared/
config.watchFolders = [monorepoRoot];

// Resolve packages from ios first, then root — order matters
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Force react + react-native to always resolve from the ios workspace.
// Without this, the root node_modules copy (from apps/web, 18.2.x) gets
// loaded alongside the Expo copy (18.3.x), causing "Invalid hook call".
config.resolver.extraNodeModules = {
  react:        path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
  "react-dom":  path.resolve(projectRoot, "node_modules/react-native"),
};

module.exports = config;
