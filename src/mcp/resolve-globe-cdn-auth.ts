import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { mintGlobeCdnIdentityJwt } from '@twinfile/cdn/edge/dma-auth';

const TOKEN_TTL_MS = 12 * 60 * 1000;

let cachedToken: string | undefined;
let cachedAt = 0;
let inflight: Promise<string | undefined> | undefined;

function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

function readConfiguredJwt(): string | undefined {
  return (
    process.env.GEOKIT_GLOBE_CDN_JWT?.trim() ||
    process.env.GLOBE_CDN_JWT?.trim() ||
    process.env.FW_GLOBE_CDN_JWT?.trim()
  );
}

function readConfiguredSecret(): string | undefined {
  return (
    process.env.GEOKIT_GLOBE_CDN_JWT_SECRET?.trim() || process.env.GLOBE_CDN_JWT_SECRET?.trim()
  );
}

function readSecretFromDotenv(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  const parsed = dotenv.parse(readFileSync(path));
  return parsed.GLOBE_CDN_JWT_SECRET?.trim();
}

function resolveJwtSecret(): string | undefined {
  const fromEnv = readConfiguredSecret();
  if (fromEnv) return fromEnv;

  const root = packageRoot();
  return (
    readSecretFromDotenv(join(root, '.env')) ??
    readSecretFromDotenv(join(root, '..', '..', 'apps', 'fieldwise', '.env')) ??
    readSecretFromDotenv(join(root, '..', '..', '.env'))
  );
}

function storeJwt(token: string): void {
  cachedToken = token;
  cachedAt = Date.now();
  process.env.GLOBE_CDN_JWT = token;
  process.env.GEOKIT_GLOBE_CDN_JWT = token;
}

/** True when a bearer token or signing secret is available for DMA CDN fetches. */
export function isGlobeCdnAuthConfigured(): boolean {
  return Boolean(readConfiguredJwt() || resolveJwtSecret());
}

/** Mint or refresh Globe CDN DMA JWT when only the HS256 secret is configured. */
export async function ensureGlobeCdnJwt(): Promise<string | undefined> {
  const configured = readConfiguredJwt();
  if (configured) {
    cachedToken = configured;
    cachedAt = Date.now();
    return configured;
  }

  if (cachedToken && Date.now() - cachedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }

  if (!inflight) {
    inflight = (async () => {
      const secret = resolveJwtSecret();
      if (!secret) return undefined;

      const token = await mintGlobeCdnIdentityJwt(secret, {
        sub: process.env.GEOKIT_CDN_TOKEN_SUB?.trim() || 'geokit-mcp',
      });
      storeJwt(token);
      return token;
    })().finally(() => {
      inflight = undefined;
    });
  }

  return inflight;
}
