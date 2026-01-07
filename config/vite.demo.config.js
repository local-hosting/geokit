import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    root: './demo',
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
    resolve: {
      preserveSymlinks: false,
    },
    define: {
      'import.meta.env.MAPTILER_API_KEY': JSON.stringify(env.MAPTILER_API_KEY),
      'import.meta.env.MAPBOX_ACCESS_TOKEN': JSON.stringify(env.MAPBOX_ACCESS_TOKEN),
    },
  };
});

