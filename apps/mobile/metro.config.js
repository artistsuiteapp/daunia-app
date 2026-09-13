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

/*
 * decode-uri-component 0.2.2, usato da expo-router per leggere gli indirizzi,
 * si blocca su sequenze UTF-8 spezzate: un collegamento costruito apposta
 * ferma l'app. La versione corretta e solo modulo ES e romperebbe query-string,
 * quindi nell'app si carica un sostituto. Spiegazione in lib/decodifica-uri.js.
 */
const SOSTITUTI = {
  'decode-uri-component': path.resolve(projectRoot, 'lib/decodifica-uri.js'),
};
const risolviDiSerie = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (SOSTITUTI[moduleName]) return { type: 'sourceFile', filePath: SOSTITUTI[moduleName] };
  return (risolviDiSerie ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
