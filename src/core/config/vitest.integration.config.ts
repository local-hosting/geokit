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
    alias: {
      'geokit/bounds': path.join(geokitRoot, 'src/utils/bounds/index.ts'),
      'geokit/types': path.join(geokitRoot, 'src/types/index.ts'),
      'geokit/distance': path.join(geokitRoot, 'src/utils/distance/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom', // Happy-DOM has better Custom Elements support than jsdom
    setupFiles: [path.join(geokitRoot, 'tests/setup/happy-dom-polyfills.ts')],
    hookTimeout: 60000, // 60 seconds for hooks (map initialization can take time)
    testTimeout: 60000, // 60 seconds for integration tests (network requests take longer)
    // Only run integration tests
    include: ['**/tests/integration/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.config.*'],
    },
    env: {
      // Pass through environment variables to tests
      MAPTILER_API_KEY: process.env.MAPTILER_API_KEY || process.env.MAPTILER_KEY || '',
      MAPBOX_ACCESS_TOKEN: process.env.MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_TOKEN || '',
      FOURSQUARE_API_KEY: process.env.FOURSQUARE_API_KEY || '',
      FOURSQUARE_SERVICE_API_KEY: process.env.FOURSQUARE_SERVICE_API_KEY || '',
      TOMORROW_IO_API_KEY: process.env.TOMORROW_IO_API_KEY || '',
    },
  },
});
