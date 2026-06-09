/**
 * Serve pipeline Globe CDN build from the geokit demo dev server (same origin).
 */
import { existsSync, readFileSync, statSync } from 'fs';
import { join, normalize, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const DEFAULT_LOCAL_CDN_BUILD = resolve(
  __dirname,
  '../../../apps/cdn/build'
);

const LOCAL_DMA_INDEX = join('markets', 'dma', 'regions', 'index.json');

const MIME = {
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function localDmaIndexPath(buildRoot) {
  return join(buildRoot, LOCAL_DMA_INDEX);
}

export function hasLocalGlobeCdnMarkets(buildRoot = DEFAULT_LOCAL_CDN_BUILD) {
  return existsSync(localDmaIndexPath(buildRoot));
}

function shouldServeGlobeCdnPath(pathname) {
  if (!pathname || pathname === '/') return false;
  if (
    pathname.startsWith('/maps') ||
    pathname.startsWith('/cdn') ||
    pathname.startsWith('/@') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/node_modules') ||
    pathname.startsWith('/src')
  ) {
    return false;
  }
  return (
    pathname.startsWith('/markets/') ||
    pathname.startsWith('/us/') ||
    pathname.startsWith('/_edge/') ||
    pathname.startsWith('/_view/') ||
    pathname === '/index.json' ||
    pathname === '/aliases.json'
  );
}

function contentType(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  return MIME[ext] ?? 'application/octet-stream';
}

export function resolveLocalGlobeCdnBuildRoot(env = process.env) {
  const fromEnv = env.GEOKIT_LOCAL_CDN_BUILD?.trim() || env.LOCAL_GLOBE_CDN_BUILD?.trim();
  return fromEnv ? resolve(fromEnv) : DEFAULT_LOCAL_CDN_BUILD;
}

export function demoLocalGlobeCdnPlugin(options = {}) {
  const buildRoot = resolveLocalGlobeCdnBuildRoot(options.env);
  const active = hasLocalGlobeCdnMarkets(buildRoot);

  return {
    name: 'geokit-demo-local-globe-cdn',
    configureServer(server) {
      if (!active) {
        console.warn(
          '[geokit demo] local Globe CDN inactive — run: cd packages/pipeline && yarn geo cdn --markets'
        );
        console.warn(`[geokit demo] expected ${localDmaIndexPath(buildRoot)}`);
        return;
      }

      console.log(`[geokit demo] serving local Globe CDN from ${buildRoot}`);

      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url || '/', 'http://localhost').pathname;
        if (!shouldServeGlobeCdnPath(pathname)) {
          next();
          return;
        }

        const relative = pathname.replace(/^\//, '');
        const filePath = join(buildRoot, relative);
        const normalizedRoot = normalize(buildRoot);
        const normalizedFile = normalize(filePath);
        if (!normalizedFile.startsWith(normalizedRoot)) {
          next();
          return;
        }

        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
          next();
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', contentType(filePath));
        res.setHeader('Cache-Control', 'no-store');
        res.end(readFileSync(filePath));
      });
    },
  };
}
