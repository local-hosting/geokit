import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { loadGeokitVitestAliases, pluginVitestAliases, vitestAliasEntries } from './vitest.aliases.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const coreRoot = path.join(repoRoot, 'src/core');
const h3Root = path.join(repoRoot, 'src/h3');

const aliases = {
  ...loadGeokitVitestAliases(),
  ...pluginVitestAliases(repoRoot),
  '@twinfile/geokit/core/containment': path.join(coreRoot, 'src/utils/containment/index.ts'),
  '@twinfile/geokit/core/h3': path.join(h3Root, 'src/index.ts'),
  '@twinfile/geokit/core': path.join(coreRoot, 'src/index.ts'),
  '@twinfile/geokit/h3/cell-to-region-index': path.join(h3Root, 'src/cell/cell-to-region-index.ts'),
  '@twinfile/geokit/h3/lite': path.join(h3Root, 'src/lite.ts'),
  '@twinfile/geokit/h3': path.join(h3Root, 'src/index.ts'),
};

export default defineConfig({
  test: {
    root: process.cwd(),
    include: ['src/crosswalk/tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: vitestAliasEntries(aliases),
  },
});
