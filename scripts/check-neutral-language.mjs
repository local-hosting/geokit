#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function s(codes) {
  return String.fromCharCode(...codes);
}

const SUBSTRINGS = [
  [1, [s([100, 111, 112, 112, 108, 101, 114, 45, 103, 114, 111, 117, 112]), s([100, 111, 112, 112, 108, 101, 114, 32, 103, 114, 111, 117, 112]), s([64, 100, 111, 112, 112, 108, 101, 114, 47]), s([64, 100, 111, 112, 112, 108, 101, 114, 45]), s([100, 111, 112, 112, 108, 101, 114, 32, 103, 108, 111, 98, 101])]],
  [2, [s([99, 111, 114, 105, 111, 45, 112, 108, 97, 116, 102, 111, 114, 109, 115]), s([64, 99, 111, 114, 105, 111, 47]), s([103, 105, 116, 104, 117, 98, 46, 99, 111, 109, 47, 99, 111, 114, 105, 111]), s([99, 111, 114, 105, 111, 32, 109, 111, 110, 111, 114, 101, 112, 111]), s([99, 111, 114, 105, 111, 32, 112, 108, 97, 116, 102, 111, 114, 109, 115])]],
  [3, [s([97, 99, 99, 111, 114, 100, 45, 108, 97, 98, 115]), s([97, 99, 99, 111, 114, 100, 32, 108, 97, 98, 115])]],
];

const SKIP_DIR = new Set(['node_modules', '.git', '.yarn', 'dist', 'coverage']);
const SKIP_FILES = new Set(['scripts/check-neutral-language.mjs']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const path = join(dir, name);
    const st = statSync(path);
    const rel = relative(root, path);
    if (st.isDirectory()) {
      if (rel === 'src/crosswalk/generated' || rel.startsWith('src/crosswalk/generated/')) continue;
      walk(path, out);
    } else if (st.isFile()) out.push(path);
  }
  return out;
}

function containsDenied(lower, needle) {
  return lower.includes(needle.toLowerCase());
}

const hits = [];
for (const file of walk(root)) {
  const rel = relative(root, file);
  if (SKIP_FILES.has(rel)) continue;
  if (rel === '.env' || rel.startsWith('.env.')) continue;
  if (file.endsWith('.png') || file.endsWith('.gz')) continue;
  const lower = readFileSync(file, 'utf8').toLowerCase();
  outer: for (const [rule, needles] of SUBSTRINGS) {
    for (const needle of needles) {
      if (containsDenied(lower, needle)) {
        hits.push(`${rel}: prohibited reference (rule ${rule})`);
        break outer;
      }
    }
  }
}

if (hits.length > 0) {
  console.error('check-neutral-language: failed\n' + hits.join('\n'));
  process.exit(1);
}

console.log('check-neutral-language: ok');
