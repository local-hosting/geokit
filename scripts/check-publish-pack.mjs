#!/usr/bin/env node
/**
 * Fail when `npm pack` would ship source, tests, or tooling outside dist trees.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const FORBIDDEN = [
  /(^|\/)tests?\//i,
  /(^|\/)__tests__\//i,
  /\.test\.(mjs|cjs|js|ts)$/i,
  /(^|\/)src\/[^/]+\/src\//,
  /(^|\/)demo\//i,
  /^config\//i,
  /^scripts\//i,
  /vitest\.config/i,
  /^tsconfig.*\.json$/i,
  /^src\/[^/]+\/README\.md$/i,
];

const ALLOWED_DIST = /^src\/(?:core|crosswalk|env|formats|h3|service|ui|providers\/[^/]+)\/dist\//;

function main() {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  if ((result.status ?? 1) !== 0) {
    console.error(result.stderr ?? result.stdout);
    process.exit(result.status ?? 1);
  }
  const jsonBlock = result.stdout.match(/\[[\s\S]*\]\s*$/);
  if (!jsonBlock) {
    console.error('[check-publish-pack] npm pack --json produced no JSON array');
    console.error(result.stdout.slice(0, 500));
    process.exit(1);
  }
  const packed = JSON.parse(jsonBlock[0]);
  const entry = Array.isArray(packed) ? packed[0] : packed;
  const files = entry?.files ?? [];
  const bad = [];

  for (const { path: filePath } of files) {
    const normalized = filePath.replace(/^package\//, '');
    if (normalized === 'package.json' || normalized === 'README.md' || normalized === 'LICENSE') {
      continue;
    }
    if (FORBIDDEN.some((re) => re.test(normalized))) {
      bad.push({ filePath: normalized, reason: 'forbidden pattern' });
      continue;
    }
    if (!ALLOWED_DIST.test(normalized)) {
      bad.push({ filePath: normalized, reason: 'outside dist allowlist' });
    }
  }

  if (bad.length > 0) {
    console.error('[check-publish-pack] npm pack would include non-dist artifacts:\n');
    for (const { filePath, reason } of bad.slice(0, 40)) {
      console.error(`  ${filePath} (${reason})`);
    }
    if (bad.length > 40) {
      console.error(`  … and ${bad.length - 40} more`);
    }
    process.exit(1);
  }

  console.log(`[check-publish-pack] ok (${files.length} files, dist-only)`);
}

main();