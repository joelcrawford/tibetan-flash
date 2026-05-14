const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so Metro can resolve shared/
config.watchFolders = [monorepoRoot];

// Resolve packages from ios first, then root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Force react + react-native to always come from the ios workspace.
// apps/web uses React 18.3.1 (hoisted to root) but Expo requires 19.1.0 —
// two copies in the bundle causes "Invalid hook call".
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "react" ||
    moduleName === "react/jsx-runtime" ||
    moduleName === "react/jsx-dev-runtime" ||
    moduleName === "react-native"
  ) {
    return context.resolveRequest(
      { ...context, originModulePath: path.resolve(projectRoot, "index.ts") },
      moduleName,
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
