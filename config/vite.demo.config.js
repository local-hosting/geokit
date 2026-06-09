import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { demoCdnIdentityPlugin } from './demo-cdn-identity-plugin.js';
import {
  demoLocalGlobeCdnPlugin,
  hasLocalGlobeCdnMarkets,
  resolveLocalGlobeCdnBuildRoot,
} from './demo-local-globe-cdn-plugin.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const localCdnBuild = resolveLocalGlobeCdnBuildRoot(env);
  const useLocalGlobeCdn = hasLocalGlobeCdnMarkets(localCdnBuild);
  const configuredCdnUrl = env.GEOKIT_GLOBE_CDN_URL || env.GLOBE_CDN_URL || '';
  const globeCdnUrl = configuredCdnUrl || (useLocalGlobeCdn ? '' : '');

  return {
    root: './demo',
    plugins: [demoLocalGlobeCdnPlugin({ env }), demoCdnIdentityPlugin(env)],
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
      fs: {
        allow: ['..'],
      },
    },
    define: {
      'import.meta.env.MAPTILER_KEY': JSON.stringify(env.MAPTILER_KEY),
      'import.meta.env.MAPBOX_TOKEN': JSON.stringify(env.MAPBOX_TOKEN),
      'import.meta.env.GEOKIT_GLOBE_CDN_URL': JSON.stringify(globeCdnUrl),
      'import.meta.env.GEOKIT_LOCAL_GLOBE_CDN': JSON.stringify(useLocalGlobeCdn),
      'process.env.GEOKIT_GLOBE_CDN_URL': JSON.stringify(globeCdnUrl),
      'process.env.GLOBE_CDN_URL': JSON.stringify(globeCdnUrl),
    },
  };
});
