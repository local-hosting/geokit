#!/usr/bin/env node
/**
 * Fail if parity-fixtures.json drifts from geokit dist output.
 * Run after `yarn build`.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = path.resolve(
  root,
  '../geokit-swift/Tests/GeoKitCoreTests/Fixtures/parity-fixtures.json'
);

if (!fs.existsSync(path.join(root, 'dist/esm/utils/bounds/index.js'))) {
  console.error('check-parity-fixtures: run `yarn build` first (dist/esm missing)');
  process.exit(1);
}

if (!fs.existsSync(fixturePath)) {
  console.error(`check-parity-fixtures: missing ${fixturePath}`);
  process.exit(1);
}

const committed = fs.readFileSync(fixturePath, 'utf8').trimEnd();
const generated = execSync('node scripts/export-parity-fixtures.mjs', {
  cwd: root,
  encoding: 'utf8',
}).trimEnd();

if (committed !== generated) {
  console.error(
    'parity-fixtures.json is out of date.\nRun: yarn export:parity-fixtures'
  );
  process.exit(1);
}

console.log('parity fixtures OK');
