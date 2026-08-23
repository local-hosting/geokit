import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const pkgRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@geokit/api/place-taxonomy': path.resolve(
        pkgRoot,
        '../api/src/place-taxonomy.ts'
      ),
      '@geokit/api/types': path.resolve(pkgRoot, '../api/src/providers/types.ts'),
      '@geokit/api/types/place-taxonomy': path.resolve(
        pkgRoot,
        '../api/src/types/place-taxonomy.ts'
      ),
      '@geokit/api/plugin': path.resolve(pkgRoot, '../api/src/plugin.ts'),
      '@geokit/api': path.resolve(pkgRoot, '../api/src/index.ts'),
      '@geokit/geotypes/geokit': path.resolve(
        pkgRoot,
        '../geotypes/src/geokit-adapter.ts'
      ),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
