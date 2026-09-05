// Metro deve vedere la root del monorepo: i JSON prodotti dall'ingest stanno in ../../data
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

/**
 * In anteprima condivisibile la traccia del sottofondo viene sostituita da una
 * sorgente vuota, cosi il file audio non viene pubblicato insieme al sito.
 */
if (process.env.EXPO_PUBLIC_PREVIEW === '1') {
  // ogni voce: modulo reale -> variante senza l'asset di terzi.
  // L'audio si tiene passando EXPO_PUBLIC_PREVIEW_AUDIO=1: e una scelta
  // esplicita, perche quella traccia sul sito viene ospitata, non collegata.
  const excluded = ['components/header-backdrop'];
  if (process.env.EXPO_PUBLIC_PREVIEW_AUDIO !== '1') {
    excluded.push('components/ambience-source');
  }
  const swaps = new Map(
    excluded.map((mod) => [
      path.resolve(projectRoot, `${mod}.ts`),
      path.resolve(projectRoot, `${mod}.preview.ts`),
    ]),
  );
  const base = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const resolver = base ?? context.resolveRequest;
    const res = resolver(context, moduleName, platform);
    if (res && 'filePath' in res && swaps.has(res.filePath)) {
      return { ...res, filePath: swaps.get(res.filePath) };
    }
    return res;
  };
}

module.exports = config;
