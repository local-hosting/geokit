import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('package exports resolve after normalize', () => {
  execFileSync('node', ['scripts/validate-package-exports.mjs'], {
    cwd: repoRoot,
    stdio: 'pipe',
  });
});
