import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { serviceVitestAliases } from './vitest.aliases';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const coreRoot = path.join(repoRoot, 'src/core');

export default defineConfig({
  resolve: {
    alias: serviceVitestAliases(repoRoot),
  },
  test: {
    root: process.cwd(),
    include: ['tests/**/*.test.ts'],
    globals: true,
    environment: 'node',
    setupFiles: [path.join(coreRoot, 'tests/setup/happy-dom-polyfills.ts')],
    pool: 'forks',
  },
});
