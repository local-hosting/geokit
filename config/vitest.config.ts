import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';

// Load .env from project root if it exists
const envPath = path.resolve(__dirname, '..', '.env');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom', // Happy-DOM has better Custom Elements support than jsdom
    setupFiles: ['./tests/setup/happy-dom-polyfills.ts'],
    hookTimeout: 60000, // 60 seconds for hooks (map initialization can take time)
    testTimeout: 30000, // 30 seconds for individual tests
    // Exclude browser-only tests and integration tests (they require Playwright/real API keys)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/ui/browser/**',
      '**/tests/integration/**',
    ],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.config.*', 'scripts/'],
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
