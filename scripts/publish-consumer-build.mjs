#!/usr/bin/env node
/**
 * Build dist artifacts required for npm publish (server + map consumers).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: false, env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const distRoots = JSON.parse(
  readFileSync(join(root, 'scripts/publish-dist-paths.json'), 'utf8'),
);

const yarnSteps = [
  ['build:env'],
  ['build:h3'],
  ['build:core'],
  ['build:formats'],
  ['build:service'],
  ['build:crosswalk'],
  ['build:foursquare'],
  ['build:ui'],
];

for (const args of yarnSteps) {
  run('yarn', args);
}

for (const rel of distRoots) {
  const marker = join(root, rel, 'esm/index.js');
  const crosswalkMarker = join(root, rel, 'esm/src/index.js');
  const abs = existsSync(marker) ? marker : crosswalkMarker;
  if (!existsSync(abs)) {
    console.error(`publish-consumer-build: missing dist at ${rel}`);
    process.exit(1);
  }
}

console.log('publish-consumer-build: OK');