import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST_TO_SRC = [
  { dist: 'src/core/dist/esm/', src: 'src/core/src/' },
  { dist: 'src/ui/dist/esm/', src: 'src/ui/src/' },
  { dist: 'src/env/dist/esm/', src: 'src/env/src/' },
  { dist: 'src/service/dist/esm/', src: 'src/service/src/' },
  { dist: 'src/h3/dist/esm/', src: 'src/h3/src/' },
  { dist: 'src/providers/foursquare/dist/esm/', src: 'src/providers/foursquare/src/' },
  { dist: 'src/crosswalk/dist/esm/src/', src: 'src/crosswalk/src/' },
  { dist: 'src/crosswalk/dist/esm/generated/', src: 'src/crosswalk/generated/' },
];

function distImportToSource(repoRoot, importPath) {
  if (!importPath.endsWith('.js')) return null;
  const mappings = [...DIST_TO_SRC].sort((a, b) => b.dist.length - a.dist.length);
  for (const { dist, src } of mappings) {
    const prefix = `./${dist}`;
    if (!importPath.startsWith(prefix)) continue;
    const rel = importPath.slice(prefix.length).replace(/\.js$/, '.ts');
    const candidate = `./${src}${rel}`;
    if (existsSync(join(repoRoot, candidate))) return candidate;
  }
  return null;
}

function resolveSourceTarget(repoRoot, entry) {
  if (typeof entry === 'string') {
    return distImportToSource(repoRoot, entry) ?? (entry.endsWith('.ts') ? entry : null);
  }
  if (entry.source && existsSync(join(repoRoot, entry.source))) return entry.source;
  const runtime = entry.import ?? entry.default;
  if (typeof runtime === 'string') {
    return distImportToSource(repoRoot, runtime) ?? (runtime.endsWith('.ts') ? runtime : null);
  }
  return null;
}

/**
 * Resolve @local-hosting/geokit/* Vitest aliases from package.json exports at runtime.
 * Avoids committing generated JSON with machine-specific absolute paths.
 */
export function buildGeokitVitestAliases(repoRoot) {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  const aliases = {};

  for (const [exportKey, entry] of Object.entries(packageJson.exports ?? {})) {
    if (!exportKey.startsWith('./')) continue;
    const target = resolveSourceTarget(repoRoot, entry);
    if (!target || !existsSync(join(repoRoot, target))) continue;
    aliases[`@local-hosting/geokit${exportKey.slice(1)}`] = join(repoRoot, target);
  }

  const providers = [
    'mapbox',
    'maptiler',
    'google',
    'esri',
    'here',
    'osm',
    ['foursquare/foursquare-places', 'src/providers/foursquare/src/foursquare-places.ts'],
  ];

  for (const item of providers) {
    if (Array.isArray(item)) {
      const [sub, rel] = item;
      aliases[`@local-hosting/geokit/${sub}`] = join(repoRoot, rel);
      continue;
    }
    const rel = `src/providers/${item}/src/index.ts`;
    if (existsSync(join(repoRoot, rel))) {
      aliases[`@local-hosting/geokit/${item}`] = join(repoRoot, rel);
    }
  }

  return aliases;
}
