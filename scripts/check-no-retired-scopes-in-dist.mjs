#!/usr/bin/env node
/**
 * Fail when compiled dist still references retired geokit package names.
 * Source may be renamed while stale local dist breaks consumers (MCP map/geo surfaces).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const BANNED = ['@doppler-hosting/geokit', '@twinfile/geokit', '@doppler-group/geokit'];
const EXT = new Set(['.js', '.cjs', '.mjs', '.d.ts']);

function walkDist(dir, hits) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDist(path, hits);
      continue;
    }
    const ext = entry.name.slice(entry.name.lastIndexOf('.'));
    if (!EXT.has(ext)) continue;
    let text;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      continue;
    }
    for (const needle of BANNED) {
      if (text.includes(needle)) {
        hits.push({ path, needle });
      }
    }
  }
}

function collectDistRoots(start) {
  const roots = [];
  const stack = [start];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules') continue;
      const path = join(dir, entry.name);
      if (entry.name === 'dist') {
        roots.push(path);
        continue;
      }
      stack.push(path);
    }
  }
  return roots;
}

const hits = [];
for (const distRoot of collectDistRoots(join(root, 'src'))) {
  walkDist(distRoot, hits);
}

if (hits.length > 0) {
  console.error('[check-no-retired-scopes-in-dist] stale package names in dist:\n');
  for (const { path, needle } of hits) {
    console.error(`  ${needle}\n    ${path.replace(`${root}/`, '')}`);
  }
  console.error('\nRun `yarn build` (or rebuild affected packages) in geokit.');
  process.exit(1);
}

console.log('[check-no-retired-scopes-in-dist] ok');