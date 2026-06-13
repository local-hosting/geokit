import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { demoCdnIdentityPlugin } from './demo-cdn-identity-plugin.js';

const configDir = fileURLToPath(new URL('.', import.meta.url));
const geokitRoot = resolve(configDir, '..');

function envValue(env, ...keys) {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return '';
}

export default defineConfig(({ mode }) => {
  const geokitEnv = loadEnv(mode, geokitRoot, '');
  const geoCdnUrl = envValue(
    geokitEnv,
    'GEOKIT_GEO_CDN_URL',
    'GEOKIT_GLOBE_CDN_URL',
    'GLOBE_CDN_URL'
  );
  const mapStyleUrl = envValue(geokitEnv, 'GEOKIT_MAP_STYLE_URL', 'MAP_STYLE_URL');
  const tileApiUrl = envValue(geokitEnv, 'GEOKIT_TILE_API_URL', 'TILE_API_URL');
  const tileCdnUrl = envValue(geokitEnv, 'GEOKIT_TILE_CDN_URL', 'TILE_CDN_URL');

  return {
    root: resolve(geokitRoot, 'src/mcp/host'),
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
      'import.meta.env.GEOKIT_MAP_STYLE_URL': JSON.stringify(mapStyleUrl),
      'import.meta.env.MAP_STYLE_URL': JSON.stringify(mapStyleUrl),
      'import.meta.env.GEOKIT_TILE_API_URL': JSON.stringify(tileApiUrl),
      'import.meta.env.TILE_API_URL': JSON.stringify(tileApiUrl),
      'import.meta.env.GEOKIT_TILE_CDN_URL': JSON.stringify(tileCdnUrl),
      'import.meta.env.TILE_CDN_URL': JSON.stringify(tileCdnUrl),
      'import.meta.env.GEOKIT_GEO_CDN_URL': JSON.stringify(geoCdnUrl),
      'import.meta.env.GEOKIT_GLOBE_CDN_URL': JSON.stringify(geoCdnUrl),
      'import.meta.env.GLOBE_CDN_URL': JSON.stringify(geoCdnUrl),
      'process.env.GEOKIT_GEO_CDN_URL': JSON.stringify(geoCdnUrl),
      'process.env.GEOKIT_GLOBE_CDN_URL': JSON.stringify(geoCdnUrl),
      'process.env.GLOBE_CDN_URL': JSON.stringify(geoCdnUrl),
    },
  };
});
