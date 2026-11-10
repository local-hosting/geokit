#!/usr/bin/env node
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const DIST_DIRS = [
  'dist',
  'src/core/dist',
  'src/ui/dist',
  'src/env/dist',
  'src/service/dist',
  'src/h3/dist',
  'src/formats/dist',
  'src/crosswalk/dist',
  'src/providers/foursquare/dist',
];

for (const rel of DIST_DIRS) {
  rmSync(join(repoRoot, rel), { recursive: true, force: true });
}
