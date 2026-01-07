import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export default defineConfig({
  test: {
    globals: true,
    browser: {
      enabled: true,
      name: 'chromium', // or 'firefox', 'webkit'
      provider: 'playwright',
      headless: true,
    },
    // Browser tests don't use forks pool
    hookTimeout: 60000, // 60 seconds for hooks (map initialization can take time)
    testTimeout: 30000, // 30 seconds for individual tests
    // Only include browser tests (Playwright required)
    include: ['**/tests/ui/browser/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/__screenshots__/**'],
    setupFiles: [path.resolve(__dirname, '..', 'tests', 'setup', 'browser-console-suppress.ts')],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.config.*', 'scripts/'],
    },
    env: {
      // Pass through environment variables to tests
      MAPTILER_API_KEY: process.env.MAPTILER_API_KEY || '',
      MAPBOX_ACCESS_TOKEN: process.env.MAPBOX_ACCESS_TOKEN || '',
      // Control browser console logging: 'none' (default), 'error', 'warn', or '1' (all)
      GEOKIT_BROWSER_LOGS: process.env.GEOKIT_BROWSER_LOGS || 'none',
    },
  },
});
