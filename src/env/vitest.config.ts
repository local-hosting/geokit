import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    name: '@twinfile/geokit/env',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@twinfile/geokit/env': path.join(root, 'src/index.ts'),
      '@twinfile/geokit/env/service-keys': path.join(root, 'src/service-keys.ts'),
      '@twinfile/geokit/env/map-credentials': path.join(root, 'src/map-credentials.ts'),
      '@twinfile/geokit/env/primitives': path.join(root, 'src/primitives.ts'),
    },
  },
});
