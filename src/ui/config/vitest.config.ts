import { defineConfig } from 'vitest/config';
import path from 'path';
import {
  loadGeokitVitestAliases,
  vitestAliasEntries,
} from '../../../config/vitest.aliases.js';

const uiRoot = path.resolve(__dirname, '..');
const geokitRoot = path.resolve(__dirname, '../../..');
const coreDist = path.join(geokitRoot, 'src/core/dist/esm');

const generated = vitestAliasEntries(loadGeokitVitestAliases(geokitRoot));

export default defineConfig({
  resolve: {
    alias: [
      ...generated,
      // UI test-only: elements-lite resolves to core dist in this suite
      { find: './elements-lite.js', replacement: path.join(coreDist, 'index.js') },
    ],
  },
  test: {
    root: uiRoot,
    name: '@local-hosting/geokit/ui',
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['../core/tests/setup/happy-dom-polyfills.ts'],
    hookTimeout: 60000,
    testTimeout: 30000,
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/unit/ui/browser/**'],
    pool: 'forks',
    env: {
      MAPTILER_KEY: process.env.MAPTILER_KEY || '',
      MAPBOX_TOKEN: process.env.MAPBOX_TOKEN || '',
    },
  },
});
