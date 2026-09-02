import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const coreRoot = path.join(repoRoot, 'src/core');
const h3Root = path.join(repoRoot, 'src/h3');

export default defineConfig({
  test: {
    root: process.cwd(),
    include: ['src/crosswalk/tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: [
      {
        find: '@twinfile/geokit/core/containment',
        replacement: path.join(coreRoot, 'src/utils/containment/index.ts'),
      },
      { find: '@twinfile/geokit/core/h3', replacement: path.join(h3Root, 'src/index.ts') },
      { find: /^@twinfile\/geokit\/core$/, replacement: path.join(coreRoot, 'src/index.ts') },
      {
        find: '@twinfile/geokit/h3/cell-to-region-index',
        replacement: path.join(h3Root, 'src/cell/cell-to-region-index.ts'),
      },
      { find: '@twinfile/geokit/h3/lite', replacement: path.join(h3Root, 'src/lite.ts') },
      { find: '@twinfile/geokit/h3', replacement: path.join(h3Root, 'src/index.ts') },
    ],
  },
});
