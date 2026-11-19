#!/usr/bin/env node
/**
 * Run ordered yarn build phases from geokit-build-phases.json (`full` | `publish`).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const mode = (process.argv[2] ?? 'full').trim();
const phases = JSON.parse(
  readFileSync(join(root, 'scripts/geokit-build-phases.json'), 'utf8'),
);
const steps = phases[mode];
if (!Array.isArray(steps)) {
  console.error(`[build] unknown mode "${mode}" (use full | publish)`);
  process.exit(1);
}

function runYarn(script) {
  const result = spawnSync('yarn', [script], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const script of steps) {
  runYarn(script);
}

if (mode === 'full') {
  const check = spawnSync('node', ['scripts/check-no-src-declarations.mjs'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (check.status !== 0) {
    process.exit(check.status ?? 1);
  }
}

console.log(`[build:${mode}] ok`);