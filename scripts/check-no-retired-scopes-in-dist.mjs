#!/usr/bin/env node
/**
 * Fail when compiled dist still references non-@local-hosting geokit package scopes.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const CANONICAL_SCOPE = '@local-hosting/geokit';
const FOREIGN_GEOKIT_SCOPE = /@[\w-]+\/geokit/g;
const EXT = new Set(['.js', '.cjs', '.mjs', '.d.ts']);

function foreignGeokitScopesIn(text) {
  const found = new Set();
  for (const match of text.matchAll(FOREIGN_GEOKIT_SCOPE)) {
    if (match[0] !== CANONICAL_SCOPE) {
      found.add(match[0]);
    }
  }
  return [...found];
}

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
    for (const needle of foreignGeokitScopesIn(text)) {
      hits.push({ path, needle });
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
  console.error('[check-no-retired-scopes-in-dist] non-canonical geokit scopes in dist:\n');
  for (const { path, needle } of hits) {
    console.error(`  ${needle}\n    ${path.replace(`${root}/`, '')}`);
  }
  console.error('\nRun `yarn build` (or rebuild affected packages) in geokit.');
  process.exit(1);
}

console.log('[check-no-retired-scopes-in-dist] ok');