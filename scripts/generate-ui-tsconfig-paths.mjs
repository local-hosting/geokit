#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imports = JSON.parse(readFileSync(join(repoRoot, 'config/tsconfig.geokit-imports.json'), 'utf8'));

const uiSelfPaths = {
  '@twinfile/geokit/ui': ['src/ui/src/index.ts'],
  '@twinfile/geokit/ui/*': ['src/ui/src/*'],
};

const mergedPaths = {
  ...(imports.compilerOptions?.paths ?? {}),
  ...uiSelfPaths,
};

writeFileSync(
  join(repoRoot, 'src/ui/config/tsconfig.build.paths.json'),
  `${JSON.stringify({ compilerOptions: { baseUrl: "../../..", paths: mergedPaths } }, null, 2)}\n`,
);
console.log(`[generate-ui-tsconfig-paths] ${Object.keys(mergedPaths).length} paths`);
