#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));

for (const script of [
  'generate-geokit-tsconfig-paths.mjs',
  'generate-pre-ui-tsconfig-paths.mjs',
  'generate-ui-tsconfig-paths.mjs',
]) {
  const result = spawnSync(process.execPath, [join(scriptsDir, script)], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('[generate-dev-config] OK');
