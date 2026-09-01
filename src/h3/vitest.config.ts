import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    name: '@geokit/h3',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@geokit/h3/cell-to-region-index': path.join(root, 'src/cell/cell-to-region-index.ts'),
      '@geokit/h3/lite': path.join(root, 'src/lite.ts'),
      '@geokit/h3': path.join(root, 'src/index.ts'),
    },
  },
});
