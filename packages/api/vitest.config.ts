import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const pkgRoot = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = path.resolve(pkgRoot, '../core');

const apiAliases: Record<string, string> = {
  '@geokit/api': path.resolve(pkgRoot, 'src/index.ts'),
  '@geokit/api/place-taxonomy': path.resolve(pkgRoot, 'src/place-taxonomy.ts'),
  '@geokit/api/registry': path.resolve(pkgRoot, 'src/providers/registry.ts'),
  '@geokit/api/setup-capability-routers': path.resolve(
    pkgRoot,
    'src/providers/setup-capability-routers.ts'
  ),
  '@geokit/api/types': path.resolve(pkgRoot, 'src/providers/types.ts'),
  '@geokit/api/types/api-composite': path.resolve(pkgRoot, 'src/types/api-composite.ts'),
  '@geokit/api/types/foursquare-places': path.resolve(
    pkgRoot,
    'src/types/foursquare-places.ts'
  ),
  '@geokit/api/types/place-taxonomy': path.resolve(pkgRoot, 'src/types/place-taxonomy.ts'),
  '@geokit/api/providers/foursquare': path.resolve(
    pkgRoot,
    'src/providers/foursquare-provider.ts'
  ),
  '@geokit/api/providers/foursquare-places': path.resolve(
    pkgRoot,
    'src/providers/foursquare-places.ts'
  ),
  '@geokit/api/providers/google-places': path.resolve(
    pkgRoot,
    'src/providers/google-places-provider.ts'
  ),
  '@geokit/api/providers/mapbox': path.resolve(pkgRoot, 'src/providers/mapbox-provider.ts'),
  '@geokit/api/providers/maptiler': path.resolve(pkgRoot, 'src/providers/maptiler-provider.ts'),
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
