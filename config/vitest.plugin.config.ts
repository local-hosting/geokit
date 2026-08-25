import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { pluginVitestAliases } from './vitest.aliases';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  resolve: {
    alias: pluginVitestAliases(repoRoot),
  },
  test: {
    root: process.cwd(),
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
  },
});
