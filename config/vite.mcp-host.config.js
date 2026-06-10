import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const configDir = fileURLToPath(new URL('.', import.meta.url));
const geokitRoot = resolve(configDir, '..');

export default defineConfig(({ mode }) => {
  const geokitEnv = loadEnv(mode, geokitRoot, '');

  return {
    root: resolve(geokitRoot, 'host/mcp'),
    resolve: {
      alias: {
        '@geokit-src': resolve(geokitRoot, 'src'),
        'maplibre-gl': resolve(geokitRoot, 'node_modules/maplibre-gl/dist/maplibre-gl-dev.js'),
      },
      preserveSymlinks: false,
    },
    server: {
      port: 3002,
      strictPort: true,
      host: true,
      fs: {
        allow: [geokitRoot],
      },
    },
    define: {
      'import.meta.env.MAPTILER_KEY': JSON.stringify(geokitEnv.MAPTILER_KEY || ''),
    },
  };
});
