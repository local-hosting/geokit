import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const pkgRoot = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = path.resolve(pkgRoot, '../core');

const apiAliases: Record<string, string> = {
  '@geokit/api': path.resolve(pkgRoot, 'src/index.ts'),
  '@geokit/api/builtins': path.resolve(pkgRoot, 'src/builtins.ts'),
  '@geokit/api/place-taxonomy': path.resolve(pkgRoot, 'src/place-taxonomy.ts'),
  '@geokit/api/registry': path.resolve(pkgRoot, 'src/providers/registry.ts'),
  '@geokit/api/types': path.resolve(pkgRoot, 'src/providers/types.ts'),
  '@geokit/api/types/api-composite': path.resolve(pkgRoot, 'src/types/api-composite.ts'),
  '@geokit/api/types/foursquare-places': path.resolve(
    pkgRoot,
    'src/types/foursquare-places.ts'
  ),
  '@geokit/api/types/place-taxonomy': path.resolve(pkgRoot, 'src/types/place-taxonomy.ts'),
  '@geokit/plugin-foursquare': path.resolve(pkgRoot, '../plugin-foursquare/src/index.ts'),
  '@geokit/plugin-foursquare/foursquare-places': path.resolve(
    pkgRoot,
    '../plugin-foursquare/src/foursquare-places.ts'
  ),
  '@geokit/plugin-google': path.resolve(pkgRoot, '../plugin-google/src/index.ts'),
  '@geokit/plugin-mapbox': path.resolve(pkgRoot, '../plugin-mapbox/src/index.ts'),
  '@geokit/plugin-maptiler': path.resolve(pkgRoot, '../plugin-maptiler/src/index.ts'),
  'geokit/utils/retry': path.resolve(coreRoot, 'src/utils/retry.ts'),
  'geokit/utils/cache': path.resolve(coreRoot, 'src/utils/cache.ts'),
  'geokit/config/env/service-keys': path.resolve(coreRoot, 'src/config/env/service-keys.ts'),
};

export default defineConfig({
  resolve: {
    alias: apiAliases,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: [path.resolve(coreRoot, 'tests/setup/happy-dom-polyfills.ts')],
    pool: 'forks',
  },
});
