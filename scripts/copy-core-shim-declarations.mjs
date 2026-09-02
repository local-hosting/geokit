#!/usr/bin/env node
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const coreRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src', 'core');
const shimRoot = join(coreRoot, 'dist', 'shim-types');
const distRoot = join(coreRoot, 'dist', 'esm');

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (!entry.name.endsWith('.d.ts')) continue;
    const rel = full.slice(shimRoot.length + 1);
    const dest = join(distRoot, rel);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(full, dest);
  }
}

await walk(shimRoot);
console.log('[copy-core-shim-declarations] OK');
