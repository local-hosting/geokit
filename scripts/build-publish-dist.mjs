#!/usr/bin/env node
/** Publishable dist slices (see publish-dist-paths.json). */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const build = spawnSync('node', ['scripts/run-geokit-build.mjs', 'publish'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
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