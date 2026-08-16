import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    root: './demo',
    resolve: {
      alias: {
        'maplibre-gl': resolve(__dirname, '../node_modules/maplibre-gl/dist/maplibre-gl-dev.js'),
      },
      preserveSymlinks: false,
    },
    server: {
      port: 3001,
      open: env.GEOKIT_DEV_OPEN || '/maps/index.html',
      host: true,
      fs: { allow: ['..'] },
    },
    define: {
      'import.meta.env.MAPTILER_KEY': JSON.stringify(env.MAPTILER_KEY),
      'import.meta.env.MAPBOX_TOKEN': JSON.stringify(env.MAPBOX_TOKEN),
    },
  };
});
