import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { demoCdnIdentityPlugin } from './demo-cdn-identity-plugin.js';

function globeCdnDevProxyTarget(env) {
  return (
    env.GEOKIT_GLOBE_CDN_URL ||
    env.GLOBE_CDN_URL ||
    'https://mapto.link'
  )
    .trim()
    .replace(/\/$/, '');
}

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    root: './demo',
    plugins: [demoCdnIdentityPlugin(env)],
    resolve: {
      alias: {
        'maplibre-gl': resolve(__dirname, '../node_modules/maplibre-gl/dist/maplibre-gl-dev.js'),
      },
      preserveSymlinks: false,
    },
    server: {
      port: 3001,
      proxy: {
        '/__globe-cdn': {
          target: globeCdnDevProxyTarget(env),
          changeOrigin: true,
          secure: true,
          rewrite: path => path.replace(/^\/__globe-cdn/, ''),
        },
      },
      open: '/maps/index.html',
      host: true,
      fs: {
        // Allow serving files from parent directory
        allow: ['..'],
      },
    },
    define: {
      'import.meta.env.MAPTILER_KEY': JSON.stringify(env.MAPTILER_KEY),
      'import.meta.env.MAPBOX_TOKEN': JSON.stringify(env.MAPBOX_TOKEN),
      'import.meta.env.GEOKIT_GLOBE_CDN_URL': JSON.stringify(env.GEOKIT_GLOBE_CDN_URL || env.GLOBE_CDN_URL || ''),
    },
  };
});

