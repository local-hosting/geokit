#!/usr/bin/env node
/**
 * CI smoke: verify tree-shake boundaries for distance vs h3-js.
 */
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const esbuildAliases = [
  `--alias:@local-hosting/geokit/core/distance=${join(repoRoot, 'src/core/src/utils/distance/index.ts')}`,
  `--alias:@local-hosting/geokit/h3=${join(repoRoot, 'src/h3/src/index.ts')}`,
  `--alias:@local-hosting/geokit/h3/lite=${join(repoRoot, 'src/h3/src/lite.ts')}`,
  `--alias:h3-js=${join(repoRoot, 'node_modules/h3-js/dist/h3-js.es.js')}`,
].join(' ');

function bundleEntry(importLine) {
  const entry = join(tmpdir(), `geokit-bundle-smoke-${Date.now()}.mjs`);
  writeFileSync(entry, `${importLine}\nconsole.log(typeof coordinatesToH3, typeof compactH3CellId, typeof haversine);\n`);
  try {
    return execSync(
      `npx esbuild ${entry} --bundle --platform=node --format=esm --log-level=error ${esbuildAliases}`,
      { encoding: 'utf8' }
    );
  } finally {
    try {
      unlinkSync(entry);
    } catch {
      /* ignore */
    }
  }
}

function assertExcludes(label, code, pattern) {
  if (pattern.test(code)) {
    console.error(`FAIL ${label}: unexpected match ${pattern}`);
    process.exit(1);
  }
  console.log(`PASS ${label}`);
}

function assertIncludes(label, code, pattern) {
  if (!pattern.test(code)) {
    console.error(`FAIL ${label}: expected match ${pattern}`);
    process.exit(1);
  }
  console.log(`PASS ${label}`);
}

const distanceOnly = bundleEntry("import { haversine } from '@local-hosting/geokit/core/distance'");
assertExcludes('core/distance excludes h3-js', distanceOnly, /h3-js/);

const h3Lite = bundleEntry("import { compactH3CellId } from '@local-hosting/geokit/h3/lite'");
assertExcludes('h3/lite excludes h3-js', h3Lite, /h3-js/);

const h3Full = bundleEntry("import { coordinatesToH3 } from '@local-hosting/geokit/h3'");
assertIncludes('h3 includes h3-js', h3Full, /h3-js/);

console.log('bundle-smoke: all checks passed');
