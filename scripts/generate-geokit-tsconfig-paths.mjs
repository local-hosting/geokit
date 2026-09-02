#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

const DIST_TO_SRC = [
  { dist: 'src/core/dist/esm/', src: 'src/core/src/' },
  { dist: 'src/ui/dist/esm/', src: 'src/ui/src/' },
  { dist: 'src/env/dist/esm/', src: 'src/env/src/' },
  { dist: 'src/service/dist/esm/', src: 'src/service/src/' },
  { dist: 'src/h3/dist/esm/', src: 'src/h3/src/' },
  { dist: 'src/providers/foursquare/dist/esm/', src: 'src/providers/foursquare/src/' },
];

function distImportToSource(importPath) {
  if (!importPath.endsWith('.js')) return null;
  for (const { dist, src } of DIST_TO_SRC) {
    const prefix = `./${dist}`;
    if (!importPath.startsWith(prefix)) continue;
    const rel = importPath.slice(prefix.length).replace(/\.js$/, '.ts');
    const candidate = `./${src}${rel}`;
    if (existsSync(join(repoRoot, candidate))) return candidate;
  }
  return null;
}

function distImportToTypes(importPath) {
  if (!importPath.endsWith('.js')) return null;
  const typesPath = importPath.replace(/\.js$/, '.d.ts');
  if (existsSync(join(repoRoot, typesPath))) return typesPath;
  return null;
}

function resolveExportTarget(entry) {
  if (typeof entry === 'string') {
    return distImportToTypes(entry) ?? distImportToSource(entry) ?? entry;
  }
  if (entry.types && existsSync(join(repoRoot, entry.types))) return entry.types;
  if (entry.source && existsSync(join(repoRoot, entry.source))) return entry.source;
  const runtime = entry.import ?? entry.default;
  if (typeof runtime === 'string') {
    return (
      distImportToTypes(runtime) ??
      distImportToSource(runtime) ??
      (runtime.endsWith('.ts') && existsSync(join(repoRoot, runtime)) ? runtime : null)
    );
  }
  return null;
}

const paths = {};
for (const [exportKey, entry] of Object.entries(packageJson.exports ?? {})) {
  if (!exportKey.startsWith('./')) continue;
  const target = resolveExportTarget(entry);
  if (!target) continue;
  const rel = target.replace(/^\.\//, '');
  if (rel.includes('src/providers/') && !rel.includes('/dist/')) continue;
  paths[`@twinfile/geokit${exportKey.slice(1)}`] = [rel];
}

const providerRoots = [
  ['mapbox', 'src/providers/mapbox/src/index.ts'],
  ['maptiler', 'src/providers/maptiler/src/index.ts'],
  ['google', 'src/providers/google/src/index.ts'],
  ['foursquare', 'src/providers/foursquare/dist/esm/index.d.ts', 'src/providers/foursquare/src/index.ts'],
  [
    'foursquare/foursquare-places',
    'src/providers/foursquare/dist/esm/foursquare-places.d.ts',
    'src/providers/foursquare/src/foursquare-places.ts',
  ],
  ['esri', 'src/providers/esri/src/index.ts'],
  ['here', 'src/providers/here/src/index.ts'],
  ['osm', 'src/providers/osm/src/index.ts'],
];

for (const row of providerRoots) {
  const [subpath, preferred, fallback = preferred] = row;
  const specifier = `@twinfile/geokit/${subpath}`;
  if (paths[specifier]) continue;
  const rel = existsSync(join(repoRoot, preferred)) ? preferred : fallback;
  if (!rel || !existsSync(join(repoRoot, rel))) continue;
  // Source-only providers are loaded at runtime via dynamic import(moduleId).
  if (!rel.includes('/dist/')) continue;
  paths[specifier] = [rel];
}

const sortedPaths = Object.fromEntries(
  Object.keys(paths).sort((a, b) => b.length - a.length).map((key) => [key, paths[key]]),
);

writeFileSync(
  join(repoRoot, 'config/tsconfig.geokit-imports.json'),
  `${JSON.stringify({ compilerOptions: { baseUrl: '..', paths: sortedPaths } }, null, 2)}\n`,
);
console.log(`[generate-geokit-tsconfig-paths] ${Object.keys(sortedPaths).length} paths`);
