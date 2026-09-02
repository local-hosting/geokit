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
  { dist: 'src/crosswalk/dist/esm/', src: 'src/crosswalk/src/' },
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

function resolveSourceTarget(entry) {
  if (typeof entry === 'string') return distImportToSource(entry) ?? (entry.endsWith('.ts') ? entry : null);
  if (entry.source) return entry.source;
  const runtime = entry.import ?? entry.default;
  if (typeof runtime === 'string') {
    return distImportToSource(runtime) ?? (runtime.endsWith('.ts') ? runtime : null);
  }
  return null;
}

const aliases = {};
for (const [exportKey, entry] of Object.entries(packageJson.exports ?? {})) {
  if (!exportKey.startsWith('./')) continue;
  const target = resolveSourceTarget(entry);
  if (!target || !existsSync(join(repoRoot, target))) continue;
  aliases[`@twinfile/geokit${exportKey.slice(1)}`] = join(repoRoot, target);
}

const providers = [
  'mapbox', 'maptiler', 'google', 'esri', 'here', 'osm',
  ['foursquare/foursquare-places', 'src/providers/foursquare/src/foursquare-places.ts'],
];
for (const item of providers) {
  if (Array.isArray(item)) {
    const [sub, rel] = item;
    aliases[`@twinfile/geokit/${sub}`] = join(repoRoot, rel);
    continue;
  }
  const rel = `src/providers/${item}/src/index.ts`;
  if (existsSync(join(repoRoot, rel))) aliases[`@twinfile/geokit/${item}`] = join(repoRoot, rel);
}

writeFileSync(
  join(repoRoot, 'config/vitest.geokit-aliases.json'),
  `${JSON.stringify(aliases, null, 2)}\n`,
);
console.log(`[generate-vitest-aliases] ${Object.keys(aliases).length} aliases`);
