import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { mintGlobeCdnIdentityJwt } from '@twinfile/cdn/edge/dma-auth';
import { GEO_CDN_JWT_KEYS, GEO_CDN_JWT_SECRET_KEYS } from '../../types/env.js';
import type { GeokitEnv } from '../../types/env.js';
import {
  resolveCdnTokenSubFromEnv,
  resolveGlobeCdnJwtFromEnv,
  resolveGlobeCdnJwtSecretFromEnv,
} from './geo-cdn.js';
import { writeEnvKeys } from './primitives.js';

const TOKEN_TTL_MS = 12 * 60 * 1000;

let cachedToken: string | undefined;
let cachedAt = 0;
let inflight: Promise<string | undefined> | undefined;

function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

function readSecretFromDotenv(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  const parsed = dotenv.parse(readFileSync(path));
  for (const key of GEO_CDN_JWT_SECRET_KEYS) {
    const value = parsed[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function resolveJwtSecret(env: GeokitEnv = process.env): string | undefined {
  const fromEnv = resolveGlobeCdnJwtSecretFromEnv(env);
  if (fromEnv) return fromEnv;

  const root = packageRoot();
  return (
    readSecretFromDotenv(join(root, '.env')) ?? readSecretFromDotenv(join(root, '..', '..', '.env'))
  );
}

function storeJwt(env: GeokitEnv, token: string): void {
  cachedToken = token;
  cachedAt = Date.now();
  writeEnvKeys(env, GEO_CDN_JWT_KEYS, token);
}

/** True when a bearer token or signing secret is available for geo CDN fetches. */
export function isGlobeCdnAuthConfigured(env: GeokitEnv = process.env): boolean {
  return Boolean(resolveGlobeCdnJwtFromEnv(env) || resolveJwtSecret(env));
}

/** Mint or refresh geo CDN JWT when only the HS256 secret is configured. */
export async function ensureGlobeCdnJwt(env: GeokitEnv = process.env): Promise<string | undefined> {
  const configured = resolveGlobeCdnJwtFromEnv(env);
  if (configured) {
    storeJwt(env, configured);
    return configured;
  }

  if (cachedToken && Date.now() - cachedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }

  if (!inflight) {
    inflight = (async () => {
      const secret = resolveJwtSecret(env);
      if (!secret) return undefined;

      const token = await mintGlobeCdnIdentityJwt(secret, {
        sub: resolveCdnTokenSubFromEnv(env),
      });
      storeJwt(env, token);
      return token;
    })().finally(() => {
      inflight = undefined;
    });
  }

  return inflight;
}
