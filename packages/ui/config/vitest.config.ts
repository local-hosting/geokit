import { defineConfig } from 'vitest/config';
import path from 'path';

const uiRoot = path.resolve(__dirname, '..');
const coreDist = path.join(uiRoot, '../core/dist/esm');

const coreAliases: Record<string, string> = {
  '@geokit/core/bounds': path.join(coreDist, 'utils/bounds/index.js'),
  '@geokit/core/coordinates': path.join(coreDist, 'utils/coordinates/index.js'),
  '@geokit/core/geojson': path.join(coreDist, 'utils/geojson/index.js'),
  '@geokit/core/geojson-loader': path.join(coreDist, 'utils/geojson-loader/index.js'),
  '@geokit/h3': path.join(uiRoot, '../h3/src/index.ts'),
  '@geokit/core/simplify': path.join(coreDist, 'utils/simplify/index.js'),
  '@geokit/ui/config/tile-cdn': path.join(uiRoot, 'src/config/tile-cdn.ts'),
  '@geokit/core/config/maptiler-dev-proxy': path.join(coreDist, 'config/maptiler-dev-proxy.js'),
  '@geokit/core/types/layer-datasets': path.join(coreDist, 'types/layer-datasets.js'),
  '@geokit/core/types/cell-layers.types': path.join(coreDist, 'types/cell-layers.types.js'),
  '@geokit/core/storage/map-offline-context-loader': path.join(coreDist, 'storage/map-offline-context-loader.js'),
  '@geokit/core/types': path.join(coreDist, 'types/index.js'),
  './elements-lite.js': path.join(coreDist, 'index.js'),
};

export default defineConfig({
  resolve: {
    alias: coreAliases,
  },
  test: {
    name: '@geokit/ui',
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup/happy-dom-polyfills.ts'],
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
