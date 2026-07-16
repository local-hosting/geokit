/**
 * Geokit demo dev server — mint Globe CDN DMA JWT locally (no host app required).
 * Uses the same HS256 secret as mapto.link edge auth.
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { mintGlobeCdnIdentityJwt } from '../src/cdn/dma-auth.ts';

function readGlobeCdnSecretFromDotenv(path) {
  if (!existsSync(path)) return undefined;
  const content = readFileSync(path, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== 'GLOBE_CDN_JWT_SECRET') continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) return value;
  }
  return undefined;
}

function resolveGlobeCdnJwtSecret(env) {
  return (
    env.GLOBE_CDN_JWT_SECRET?.trim() ||
    process.env.GLOBE_CDN_JWT_SECRET?.trim() ||
    readGlobeCdnSecretFromDotenv(resolve(process.cwd(), '.env')) ||
    readGlobeCdnSecretFromDotenv(resolve(process.cwd(), '../../.env'))
  );
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(JSON.stringify(body));
}

export function demoCdnIdentityPlugin(env = {}) {
  const secret = resolveGlobeCdnJwtSecret(env);

  return {
    name: 'geokit-demo-cdn-identity',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (url.pathname !== '/api/cdn/identity-token' || req.method !== 'GET') {
          next();
          return;
        }

        if (!secret) {
          sendJson(res, 503, {
            error: 'CDN JWT secret not configured',
            hint: 'set GLOBE_CDN_JWT_SECRET in packages/geokit/.env or the host app .env',
          });
          return;
        }

        try {
          const sub =
            req.headers['x-account-catalog-did']?.trim?.() ||
            req.headers['x-fw-session-sub']?.trim?.() ||
            env.FW_DEV_CDN_TOKEN_SUB?.trim() ||
            'geokit-demo';
          const tenant = req.headers['x-account-catalog-did']?.trim?.() || sub;
          const token = await mintGlobeCdnIdentityJwt(secret, { sub, tenant });
          sendJson(res, 200, { token });
        } catch (err) {
          sendJson(res, 500, {
            error: 'CDN identity token failed',
            details: err instanceof Error ? err.message : String(err),
          });
        }
      });
    },
  };
}
