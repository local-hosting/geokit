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
