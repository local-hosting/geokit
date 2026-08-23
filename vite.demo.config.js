import { defineConfig, loadEnv } from 'vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const repoRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '');

  return {
    root: resolve(repoRoot, 'demo'),
    resolve: {
      alias: {
        'maplibre-gl': resolve(repoRoot, 'node_modules/maplibre-gl/dist/maplibre-gl-dev.js'),
      },
      preserveSymlinks: false,
    },
    server: {
      port: 3001,
      open: env.GEOKIT_DEV_OPEN || '/maps/index.html',
      host: true,
      fs: { allow: [repoRoot] },
    },
    define: {
      'import.meta.env.MAPTILER_KEY': JSON.stringify(env.MAPTILER_KEY),
      'import.meta.env.MAPBOX_TOKEN': JSON.stringify(env.MAPBOX_TOKEN),
    },
  };
});
