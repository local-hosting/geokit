#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const importsPath = join(repoRoot, 'config/tsconfig.geokit-imports.json');
const imports = JSON.parse(readFileSync(importsPath, 'utf8'));

const stubPaths = {
  '@doppler-group/geokit/service/types/api-composite': [
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
