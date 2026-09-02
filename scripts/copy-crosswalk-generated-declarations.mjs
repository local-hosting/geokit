#!/usr/bin/env node
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src', 'crosswalk');

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (!entry.name.endsWith('.d.ts')) continue;
    const rel = relative(packageRoot, full).replace(/\\/g, '/');
    if (!rel.startsWith('generated/')) continue;
    const dest = join(packageRoot, 'dist/esm', rel);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(full, dest);
  }
}

await walk(join(packageRoot, 'generated'));
console.log('[copy-crosswalk-generated-declarations] OK');
