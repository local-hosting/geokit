#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const importsPath = join(repoRoot, 'config/tsconfig.geokit-imports.json');
const imports = JSON.parse(readFileSync(importsPath, 'utf8'));

const stubPaths = {
  '@twinfile/geokit/ui/config/map-style': ['src/core/config/build-stubs/ui/config/map-style.d.ts'],
  '@twinfile/geokit/ui/config/tile-cdn': ['src/core/config/build-stubs/ui/config/tile-cdn.d.ts'],
  '@twinfile/geokit/ui/storage': ['src/core/config/build-stubs/ui/storage/index.d.ts'],
  '@twinfile/geokit/ui/storage/map-local-store': ['src/core/config/build-stubs/ui/storage/map-local-store.d.ts'],
  '@twinfile/geokit/ui/storage/map-offline-tile-cache': [
    'src/core/config/build-stubs/ui/storage/map-offline-tile-cache.d.ts',
  ],
  '@twinfile/geokit/ui/geojson-loader': ['src/core/config/build-stubs/ui/geojson-loader/index.d.ts'],
  '@twinfile/geokit/service/types/api-composite': [
    'src/core/config/build-stubs/service/types/api-composite.d.ts',
  ],
};

const mergedPaths = {
  ...(imports.compilerOptions?.paths ?? {}),
  ...stubPaths,
};

writeFileSync(
  join(repoRoot, 'src/core/config/tsconfig.build.pre-ui.paths.json'),
  `${JSON.stringify({ compilerOptions: { paths: mergedPaths } }, null, 2)}\n`,
);
console.log(`[generate-pre-ui-tsconfig-paths] ${Object.keys(mergedPaths).length} paths`);
