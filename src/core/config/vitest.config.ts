import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';

// Load .env from project root if it exists
const envPath = path.resolve(__dirname, '..', '.env');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const geokitRoot = path.resolve(__dirname, '..');

export default defineConfig({
  resolve: {
    alias: [
      { find: '@geokit/core/bounds', replacement: path.join(geokitRoot, 'src/utils/bounds/index.ts') },
      { find: '@geokit/core/types', replacement: path.join(geokitRoot, 'src/types/index.ts') },
      { find: '@geokit/core/distance', replacement: path.join(geokitRoot, 'src/utils/distance/index.ts') },
      { find: '@geokit/h3/cell-to-region-index', replacement: path.join(geokitRoot, '..', 'h3', 'src', 'cell/cell-to-region-index.ts') },
      { find: '@geokit/h3/lite', replacement: path.join(geokitRoot, '..', 'h3', 'src', 'lite.ts') },
      { find: '@geokit/h3', replacement: path.join(geokitRoot, '..', 'h3', 'src', 'index.ts') },
      { find: '@geokit/env/service-keys', replacement: path.join(geokitRoot, '..', 'env', 'src', 'service-keys.ts') },
      { find: '@geokit/env/map-credentials', replacement: path.join(geokitRoot, '..', 'env', 'src', 'map-credentials.ts') },
      { find: '@geokit/env/primitives', replacement: path.join(geokitRoot, '..', 'env', 'src', 'primitives.ts') },
      { find: '@geokit/env', replacement: path.join(geokitRoot, '..', 'env', 'src', 'index.ts') },
      { find: '@geokit/ui/storage/indexed-db', replacement: path.join(geokitRoot, '..', 'ui', 'src', 'storage', 'indexed-db.ts') },
      { find: '@geokit/ui/storage/map-local-store', replacement: path.join(geokitRoot, '..', 'ui', 'src', 'storage', 'map-local-store.ts') },
      { find: '@geokit/ui/storage/map-offline-context-loader', replacement: path.join(geokitRoot, '..', 'ui', 'src', 'storage', 'map-offline-context-loader.ts') },
      { find: '@geokit/ui/storage/map-offline-tile-cache', replacement: path.join(geokitRoot, '..', 'ui', 'src', 'storage', 'map-offline-tile-cache.ts') },
      { find: '@geokit/ui/storage', replacement: path.join(geokitRoot, '..', 'ui', 'src', 'storage', 'index.ts') },
      { find: '@geokit/ui/geojson-loader/shard-loader', replacement: path.join(geokitRoot, '..', 'ui', 'src', 'geojson-loader', 'shard-loader.ts') },
      { find: '@geokit/ui/geojson-loader', replacement: path.join(geokitRoot, '..', 'ui', 'src', 'geojson-loader', 'index.ts') },
      { find: '@geokit/ui/config/tile-cdn', replacement: path.join(geokitRoot, '..', 'ui', 'src', 'config', 'tile-cdn.ts') },
    ],
  },
  test: {
    globals: true,
    environment: 'happy-dom', // Happy-DOM has better Custom Elements support than jsdom
    setupFiles: [path.join(geokitRoot, 'tests/setup/happy-dom-polyfills.ts')],
    hookTimeout: 60000, // 60 seconds for hooks (map initialization can take time)
    testTimeout: 30000, // 30 seconds for individual tests
    // Exclude browser-only tests and integration tests (they require Playwright/real API keys)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/unit/ui/browser/**',
      '**/tests/integration/**',
    ],
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/utils/**/*.ts',
        '../api/src/providers/**/*.ts',
        'src/config/env/**/*.ts',
        'src/config/tile-cdn.ts',
        'src/contract/**/*.ts',
        'src/storage/**/*.ts',
      ],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.config.*',
        'src/**/*.d.ts',
        'src/**/index.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
    env: {
      // Pass through environment variables to tests
      MAPTILER_KEY: process.env.MAPTILER_KEY || '',
      MAPBOX_TOKEN: process.env.MAPBOX_TOKEN || '',
      FOURSQUARE_API_KEY: process.env.FOURSQUARE_API_KEY || '',
      FOURSQUARE_SERVICE_API_KEY: process.env.FOURSQUARE_SERVICE_API_KEY || '',
    },
  },
});
