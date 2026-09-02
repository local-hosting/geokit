import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';
import { loadGeokitVitestAliases, vitestAliasEntries } from '../../../config/vitest.aliases.js';

const envPath = path.resolve(__dirname, '..', '.env');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const geokitRoot = path.resolve(__dirname, '..');

export default defineConfig({
  resolve: {
    alias: vitestAliasEntries(loadGeokitVitestAliases()),
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
