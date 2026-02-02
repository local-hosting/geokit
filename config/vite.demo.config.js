import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    root: './demo',
    resolve: {
      alias: {
        'maplibre-gl': resolve(__dirname, '../node_modules/maplibre-gl/dist/maplibre-gl-dev.js'),
      },
      preserveSymlinks: false,
    },
    build: {
      outDir: '../dist-demo',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, '../demo/index.html'),
        },
      },
    },
    server: {
      port: 3001,
      open: true,
      host: true,
      fs: {
        // Allow serving files from parent directory
        allow: ['..'],
      },
    },
    define: {
      'import.meta.env.MAPTILER_KEY': JSON.stringify(env.MAPTILER_KEY),
      'import.meta.env.MAPBOX_TOKEN': JSON.stringify(env.MAPBOX_TOKEN),
    },
  };
});

