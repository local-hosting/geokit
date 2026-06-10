import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { demoCdnIdentityPlugin } from './demo-cdn-identity-plugin.js';

const configDir = fileURLToPath(new URL('.', import.meta.url));
const geokitRoot = resolve(configDir, '..');

export default defineConfig(({ mode }) => {
  const geokitEnv = loadEnv(mode, geokitRoot, '');
  const globeCdnUrl =
    geokitEnv.GEOKIT_GLOBE_CDN_URL?.trim() ||
    geokitEnv.GLOBE_CDN_URL?.trim() ||
    geokitEnv.FW_GLOBE_CDN_URL?.trim() ||
    'https://mapto.link';

  return {
    root: resolve(geokitRoot, 'host/mcp'),
    plugins: [demoCdnIdentityPlugin(geokitEnv)],
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
      'import.meta.env.GEOKIT_MAP_PROVIDER': JSON.stringify(geokitEnv.GEOKIT_MAP_PROVIDER || ''),
      'import.meta.env.MAP_PROVIDER': JSON.stringify(geokitEnv.MAP_PROVIDER || ''),
      'import.meta.env.GEOKIT_MAP_API_KEY': JSON.stringify(geokitEnv.GEOKIT_MAP_API_KEY || ''),
      'import.meta.env.MAP_API_KEY': JSON.stringify(geokitEnv.MAP_API_KEY || ''),
      'import.meta.env.MAPTILER_KEY': JSON.stringify(geokitEnv.MAPTILER_KEY || ''),
      'import.meta.env.GEOKIT_MAPTILER_KEY': JSON.stringify(geokitEnv.GEOKIT_MAPTILER_KEY || ''),
      'import.meta.env.MAPBOX_TOKEN': JSON.stringify(
        geokitEnv.MAPBOX_TOKEN || geokitEnv.MAPBOX_ACCESS_TOKEN || ''
      ),
      'import.meta.env.MAPBOX_ACCESS_TOKEN': JSON.stringify(geokitEnv.MAPBOX_ACCESS_TOKEN || ''),
      'import.meta.env.GEOKIT_MAPBOX_KEY': JSON.stringify(geokitEnv.GEOKIT_MAPBOX_KEY || ''),
      'import.meta.env.GEOKIT_GLOBE_CDN_URL': JSON.stringify(globeCdnUrl),
      'import.meta.env.GLOBE_CDN_URL': JSON.stringify(globeCdnUrl),
      'process.env.GEOKIT_GLOBE_CDN_URL': JSON.stringify(globeCdnUrl),
      'process.env.GLOBE_CDN_URL': JSON.stringify(globeCdnUrl),
    },
  };
});
