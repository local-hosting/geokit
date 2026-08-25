import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { geotypesVitestAliases } from './vitest.aliases.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  resolve: {
    alias: geotypesVitestAliases(repoRoot),
  },
  test: {
    root: process.cwd(),
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
