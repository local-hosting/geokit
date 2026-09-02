#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const SCAN_ROOTS = [
  'src/core/src',
  'src/ui/src',
  'src/h3/src',
  'src/env/src',
  'src/service/src',
  'src/crosswalk/src',
  'src/providers/foursquare/src',
];

/** @param {string} dir @returns {string[]} */
function findDeclarationArtifacts(dir) {
  const hits = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      hits.push(...findDeclarationArtifacts(full));
      continue;
    }
    if (name.endsWith('.d.ts.map')) {
      hits.push(full);
      continue;
    }
    if (name.endsWith('.d.ts') && existsSync(`${full}.map`)) {
      hits.push(full);
    }
  }
  return hits;
}

const stray = SCAN_ROOTS.flatMap((rel) => {
  const abs = join(repoRoot, rel);
  try {
    return findDeclarationArtifacts(abs);
  } catch {
    return [];
  }
});

if (stray.length > 0) {
  console.error('[@twinfile/geokit] do not emit .d.ts under package src/. Remove artifacts and fix the build.');
  for (const file of stray) console.error(`  ${file}`);
  process.exit(1);
}
