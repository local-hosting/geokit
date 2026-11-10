#!/usr/bin/env node
/**
 * Build dist artifacts required by server-side consumers of geokit packages
 * without the full UI/core typecheck graph that blocks `yarn build` in CI-less publish.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const tsupBin = join(root, 'node_modules/.bin/tsup');

const steps = [
  () => run('yarn', ['build:h3']),
  () => run(tsupBin, ['--config', 'config/tsup.config.js'], join(root, 'src/crosswalk')),
  () => run('yarn', ['build:core:bundle']),
  () => run(tsupBin, ['--config', 'config/tsup.config.js'], join(root, 'src/formats')),
];

for (const step of steps) {
  step();
}

const required = [
  'src/h3/dist/esm/index.js',
  'src/crosswalk/dist/esm/src/index.js',
  'src/core/dist/esm/index.js',
  'src/formats/dist/esm/index.js',
];

for (const rel of required) {
  const abs = join(root, rel);
  if (!existsSync(abs)) {
    console.error(`publish-consumer-build: missing ${rel}`);
    process.exit(1);
  }
}

console.log('publish-consumer-build: OK');
