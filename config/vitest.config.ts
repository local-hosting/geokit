import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom', // Happy-DOM has better Custom Elements support than jsdom
    setupFiles: ['./tests/setup/happy-dom-polyfills.ts'],
    hookTimeout: 60000, // 60 seconds for hooks (map initialization can take time)
    testTimeout: 30000, // 30 seconds for individual tests
    // Exclude browser-only tests (they require Playwright)
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/ui/browser/**'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.config.*', 'scripts/'],
    },
    env: {
      // Pass through environment variables to tests
      MAPTILER_API_KEY: process.env.MAPTILER_API_KEY || '',
      MAPBOX_ACCESS_TOKEN: process.env.MAPBOX_ACCESS_TOKEN || '',
    },
  },
});
