#!/usr/bin/env node
/**
 * Dist slices that ship on npm (see publish-dist-paths.json). Skips full UI tsc;
 * uses the same path-codegen gates as `yarn build` through foursquare + ui bundle.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function runYarn(args) {
  const result = spawnSync('yarn', args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const steps = [
  ['generate:tsconfig-paths'],
  ['build:env'],
  ['build:h3'],
  ['generate:tsconfig-paths'],
  ['build:core:bundle'],
  ['generate:pre-ui-tsconfig-paths'],
  ['build:core:types:pre-ui'],
  ['generate:tsconfig-paths'],
  ['build:formats'],
  ['generate:tsconfig-paths'],
  ['build:service'],
  ['build:crosswalk'],
  ['generate:tsconfig-paths'],
  ['build:foursquare'],
  ['build:ui:bundle'],
];

for (const args of steps) {
  runYarn(args);
}

const distRoots = JSON.parse(
  readFileSync(join(root, 'scripts/publish-dist-paths.json'), 'utf8'),
);

for (const rel of distRoots) {
  const marker = join(root, rel, 'esm/index.js');
  const crosswalkMarker = join(root, rel, 'esm/src/index.js');
  const abs = existsSync(marker) ? marker : crosswalkMarker;
  if (!existsSync(abs)) {
    console.error(`[build:publish] missing dist at ${rel}`);
    process.exit(1);
  }
}

console.log('[build:publish] ok');