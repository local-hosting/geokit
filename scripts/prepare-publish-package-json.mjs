#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(path, 'utf8'));

for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
  const block = pkg[section];
  if (!block || typeof block !== 'object') continue;
  for (const [name, spec] of Object.entries(block)) {
    if (typeof spec === 'string' && spec.startsWith('link:')) {
      delete block[name];
    }
  }
}

if (!pkg.dependencies?.['h3-js']) {
  throw new Error('prepare-publish-package-json: h3-js must be in dependencies');
}

writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('[prepare-publish-package-json] stripped link: dependencies');
