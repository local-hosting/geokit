import { defineConfig } from 'vitest/config';
import path from 'path';

const uiRoot = path.resolve(__dirname, '..');
const coreRoot = path.join(uiRoot, '../core');
const coreDist = path.join(coreRoot, 'dist/esm');
const coreSrc = path.join(coreRoot, 'src');
const h3Root = path.join(uiRoot, '../h3/src');

const geokitRoot = path.resolve(__dirname, '..');
const serviceSrc = path.join(uiRoot, '../service/src');

export default defineConfig({
  resolve: {
    alias: [
      { find: '@doppler-group/geokit/core/bounds', replacement: path.join(coreDist, 'utils/bounds/index.js') },
      { find: '@doppler-group/geokit/core/coordinates', replacement: path.join(coreDist, 'utils/coordinates/index.js') },
      { find: '@doppler-group/geokit/core/geojson', replacement: path.join(coreDist, 'utils/geojson/index.js') },
      { find: '@doppler-group/geokit/core/simplify', replacement: path.join(coreDist, 'utils/simplify/index.js') },
      { find: '@doppler-group/geokit/core/types/layer-datasets', replacement: path.join(coreDist, 'types/layer-datasets.js') },
      { find: '@doppler-group/geokit/core/types/cell-layers.types', replacement: path.join(coreDist, 'types/cell-layers.types.js') },
      { find: '@doppler-group/geokit/core/types', replacement: path.join(coreDist, 'types/index.js') },
      { find: '@doppler-group/geokit/core/containment', replacement: path.join(coreSrc, 'utils/containment/index.ts') },
      {
        find: '@doppler-group/geokit/service/types/api-composite',
        replacement: path.join(serviceSrc, 'types/api-composite.ts'),
      },
      { find: '@doppler-group/geokit/h3/cell-to-region-index', replacement: path.join(h3Root, 'cell/cell-to-region-index.ts') },
      { find: '@doppler-group/geokit/h3/lite', replacement: path.join(h3Root, 'lite.ts') },
      { find: '@doppler-group/geokit/h3', replacement: path.join(h3Root, 'index.ts') },
      { find: '@doppler-group/geokit/ui/config/tile-cdn', replacement: path.join(uiRoot, 'src/config/tile-cdn.ts') },
      { find: /^@doppler-group\/geokit\/core$/, replacement: path.join(coreSrc, 'index.ts') },
      { find: './elements-lite.js', replacement: path.join(coreDist, 'index.js') },
    ],
  },
  test: {
    name: '@doppler-group/geokit/ui',
    globals: true,
    environment: 'happy-dom',
    setupFiles: [path.join(geokitRoot, 'tests/setup/happy-dom-polyfills.ts')],
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
