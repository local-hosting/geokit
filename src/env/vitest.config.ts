import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    name: '@doppler-group/geokit/env',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@doppler-group/geokit/env': path.join(root, 'src/index.ts'),
      '@doppler-group/geokit/env/service-keys': path.join(root, 'src/service-keys.ts'),
      '@doppler-group/geokit/env/map-credentials': path.join(root, 'src/map-credentials.ts'),
      '@doppler-group/geokit/env/primitives': path.join(root, 'src/primitives.ts'),
    },
  },
});
