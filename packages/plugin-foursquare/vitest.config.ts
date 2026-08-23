import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const pkgRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@geokit/api/place-taxonomy': path.resolve(pkgRoot, '../api/src/place-taxonomy.ts'),
      '@geokit/api/types': path.resolve(pkgRoot, '../api/src/providers/types.ts'),
      '@geokit/api/types/place-taxonomy': path.resolve(pkgRoot, '../api/src/types/place-taxonomy.ts'),
      '@geokit/api/types/api-composite': path.resolve(pkgRoot, '../api/src/types/api-composite.ts'),
      '@geokit/api/plugin': path.resolve(pkgRoot, '../api/src/plugin.ts'),
      '@geokit/api/registry': path.resolve(pkgRoot, '../api/src/providers/registry.ts'),
      '@geokit/api/setup-capability-routers': path.resolve(pkgRoot, '../api/src/providers/setup-capability-routers.ts'),
      '@geokit/api': path.resolve(pkgRoot, '../api/src/index.ts'),
      '@geokit/geotypes/geokit': path.resolve(pkgRoot, '../geotypes/src/geokit-adapter.ts'),
      'geokit/config/env/service-keys': path.resolve(pkgRoot, '../core/src/config/env/service-keys.ts'),
      '../../../core/tests/fixtures/geojson': path.resolve(pkgRoot, '../core/tests/fixtures/geojson.ts'),
      '../../../core/tests/mocks/fetch': path.resolve(pkgRoot, '../core/tests/mocks/fetch.ts'),
      '../../../core/tests/mocks/mock-api-provider': path.resolve(pkgRoot, '../core/tests/mocks/mock-api-provider.ts'),
      '../../../core/tests/fixtures/locations': path.resolve(pkgRoot, '../core/tests/fixtures/locations.ts'),
    },
  },
  test: { include: ['tests/**/*.test.ts'] },
});
