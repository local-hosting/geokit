#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imports = JSON.parse(readFileSync(join(repoRoot, 'config/tsconfig.geokit-imports.json'), 'utf8'));

const uiSelfPaths = {
  '@doppler-group/geokit/ui': ['src/ui/src/index.ts'],
  '@doppler-group/geokit/ui/*': ['src/ui/src/*'],
};

const importPaths = { ...(imports.compilerOptions?.paths ?? {}) };
for (const key of Object.keys(importPaths)) {
  if (key === '@doppler-group/geokit/ui' || key.startsWith('@doppler-group/geokit/ui/')) {
    delete importPaths[key];
  }
}
const mergedPaths = {
  ...importPaths,
  ...uiSelfPaths,
};

writeFileSync(
  join(repoRoot, 'src/ui/config/tsconfig.build.paths.json'),
  `${JSON.stringify({ compilerOptions: { baseUrl: "../../..", paths: mergedPaths } }, null, 2)}\n`,
);
console.log(`[generate-ui-tsconfig-paths] ${Object.keys(mergedPaths).length} paths`);
