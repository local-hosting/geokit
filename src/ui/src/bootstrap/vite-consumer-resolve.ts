import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Alias, Plugin } from 'vite';

function firstExistingPath(paths: string[]): string | null {
  for (const path of paths) {
    if (existsSync(path)) return path;
  }
  return null;
}

function nestedPackageRoot(geokitPackageRoot: string, ...segments: string[]): string | null {
  return firstExistingPath([
    resolve(geokitPackageRoot, 'node_modules', ...segments),
    resolve(geokitPackageRoot, '..', ...segments),
  ]);
}

/**
 * Resolve map SDK paths nested under geokit without adding maplibre / mapbox / maptiler as app deps.
 * MapTiler SDK expects a default export; the production UMD build does not provide one under native ESM.
 */
export function geokitConsumerViteResolveAliases(geokitPackageRoot: string): Alias[] {
  const aliases: Alias[] = [];

  const maplibrePkg = nestedPackageRoot(geokitPackageRoot, 'maplibre-gl');
  if (maplibrePkg) {
    const maplibreDev = resolve(maplibrePkg, 'dist/maplibre-gl-dev.js');
    const maplibreCss = resolve(maplibrePkg, 'dist/maplibre-gl.css');
    if (existsSync(maplibreCss)) {
      aliases.push({
        find: /^maplibre-gl\/dist\/maplibre-gl\.css$/,
        replacement: maplibreCss,
      });
    }
    if (existsSync(maplibreDev)) {
      aliases.push({ find: /^maplibre-gl$/, replacement: maplibreDev });
    }
  }

  const mapboxPkg = nestedPackageRoot(geokitPackageRoot, 'mapbox-gl');
  if (mapboxPkg) {
    const mapboxJs = resolve(mapboxPkg, 'dist/mapbox-gl.js');
    const mapboxCss = resolve(mapboxPkg, 'dist/mapbox-gl.css');
    if (existsSync(mapboxJs)) {
      aliases.push({ find: /^mapbox-gl$/, replacement: mapboxJs });
    }
    if (existsSync(mapboxCss)) {
      aliases.push({
        find: /^mapbox-gl\/dist\/mapbox-gl\.css$/,
        replacement: mapboxCss,
      });
    }
  }

  const maptilerPkg = nestedPackageRoot(geokitPackageRoot, '@maptiler', 'sdk');
  if (maptilerPkg) {
    const maptilerJs = resolve(maptilerPkg, 'dist/maptiler-sdk.mjs');
    const maptilerCss = resolve(maptilerPkg, 'dist/maptiler-sdk.css');
    if (existsSync(maptilerJs)) {
      aliases.push({ find: /^@maptiler\/sdk$/, replacement: maptilerJs });
    }
    if (existsSync(maptilerCss)) {
      aliases.push({
        find: /^@maptiler\/sdk\/dist\/maptiler-sdk\.css$/,
        replacement: maptilerCss,
      });
    }
  }

  return aliases;
}

const OPTIMIZE_DEPS_ALIAS_KEYS: Record<string, string> = {
  '^maplibre-gl$': 'maplibre-gl',
  '^maplibre-gl\\/dist\\/maplibre-gl\\.css$': 'maplibre-gl/dist/maplibre-gl.css',
  '^mapbox-gl$': 'mapbox-gl',
  '^mapbox-gl\\/dist\\/mapbox-gl\\.css$': 'mapbox-gl/dist/mapbox-gl.css',
  '^@maptiler\\/sdk$': '@maptiler/sdk',
  '^@maptiler\\/sdk\\/dist\\/maptiler-sdk\\.css$': '@maptiler/sdk/dist/maptiler-sdk.css',
};

/** esbuild alias map for optimizeDeps (same paths as {@link geokitConsumerViteResolveAliases}). */
export function geokitConsumerOptimizeDepsEsbuildAliases(
  geokitPackageRoot: string,
): Record<string, string> {
  const aliases = geokitConsumerViteResolveAliases(geokitPackageRoot);
  const out: Record<string, string> = {};
  for (const entry of aliases) {
    if (typeof entry.find === 'string') {
      out[entry.find] = entry.replacement;
      continue;
    }
    if (!(entry.find instanceof RegExp)) continue;
    const key = OPTIMIZE_DEPS_ALIAS_KEYS[entry.find.source];
    if (key) out[key] = entry.replacement;
  }
  return out;
}

function replacementForFind(aliases: Alias[], id: string): string | null {
  for (const entry of aliases) {
    if (entry.find instanceof RegExp) {
      if (entry.find.test(id)) return entry.replacement;
      continue;
    }
    if (entry.find === id) return entry.replacement;
  }
  return null;
}

/** Pre-resolve nested map SDK ids (Vite alias alone can miss optimizeDeps edge cases). */
export function geokitConsumerViteResolvePlugin(geokitPackageRoot: string): Plugin {
  const aliases = geokitConsumerViteResolveAliases(geokitPackageRoot);
  return {
    name: 'geokit-map-sdk-resolve',
    enforce: 'pre',
    resolveId(source) {
      return replacementForFind(aliases, source) ?? null;
    },
  };
}