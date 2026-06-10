/**
 * Mint Globe CDN DMA JWT for the geokit MCP child process.
 * Uses GLOBE_CDN_JWT when set; otherwise signs from GLOBE_CDN_JWT_SECRET.
 */

import { mintGlobeCdnIdentityJwt } from '@twinfile/cdn/edge/dma-auth';

function readExistingJwt(env) {
  return (
    env.GEOKIT_GLOBE_CDN_JWT?.trim() ||
    env.GLOBE_CDN_JWT?.trim() ||
    env.FW_GLOBE_CDN_JWT?.trim() ||
    undefined
  );
}

function readJwtSecret(env) {
  return env.GEOKIT_GLOBE_CDN_JWT_SECRET?.trim() || env.GLOBE_CDN_JWT_SECRET?.trim() || undefined;
}

function storeJwt(env, token) {
  env.GLOBE_CDN_JWT = token;
  env.GEOKIT_GLOBE_CDN_JWT = token;
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {Promise<string | undefined>}
 */
export async function mintGlobeCdnJwtForMcp(env) {
  const existing = readExistingJwt(env);
  if (existing) {
    storeJwt(env, existing);
    return existing;
  }

  const secret = readJwtSecret(env);
  if (!secret) return undefined;

  const token = await mintGlobeCdnIdentityJwt(secret, {
    sub: env.GEOKIT_CDN_TOKEN_SUB?.trim() || 'geokit-mcp',
  });
  storeJwt(env, token);
  return token;
}
