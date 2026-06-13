// @vitest-environment node

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import dotenv from 'dotenv';
import { ensureGlobeCdnJwt, resolveGlobeCdnFetchOptions } from '../../../src/config/env/index.js';

const geokitEnv = join(process.cwd(), '.env');

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const parsed = dotenv.parse(readFileSync(path));
  for (const [key, value] of Object.entries(parsed)) {
    if (!process.env[key]?.trim()) {
      process.env[key] = value;
    }
  }
}

let baselineEnv: Record<string, string | undefined>;

beforeAll(() => {
  loadEnvFile(geokitEnv);
  baselineEnv = { ...process.env };
});

afterEach(() => {
  process.env = { ...baselineEnv };
});

describe('resolve-globe-cdn-auth', () => {
  it('mints JWT from GEOKIT_GEO_CDN_JWT_SECRET when no bearer token is set', async () => {
    process.env.GEOKIT_GEO_CDN_JWT = '';
    process.env.GLOBE_CDN_JWT = '';
    process.env.GEOKIT_GEO_CDN_JWT_SECRET = 'test-secret-for-mint';

    const token = await ensureGlobeCdnJwt();
    expect(token).toBeTruthy();
    expect(process.env.GLOBE_CDN_JWT).toBe(token);
    expect(resolveGlobeCdnFetchOptions().init?.headers).toMatchObject({
      Authorization: `Bearer ${token}`,
    });
  });

  it('loads new-york DMA shape when secret and geo CDN URL are configured', async () => {
    const secret =
      process.env.GEOKIT_GEO_CDN_JWT_SECRET?.trim() || process.env.GLOBE_CDN_JWT_SECRET?.trim();
    const geoCdnUrl =
      process.env.GEOKIT_GEO_CDN_URL?.trim() ||
      process.env.GEOKIT_GLOBE_CDN_URL?.trim() ||
      process.env.GLOBE_CDN_URL?.trim();
    if (!secret || !geoCdnUrl) {
      return;
    }

    vi.resetModules();
    const { ensureGlobeCdnJwt: ensureJwt } = await import('../../../src/config/env/index.js');
    const { fetchDmaMarketShapeFeature: fetchDma } = await import('../../../src/cdn/dma.js');
    const { resolveGlobeCdnFetchOptions: resolveCdnOptions } = await import(
      '../../../src/config/env/index.js'
    );

    await ensureJwt();
    const feature = await fetchDma('new-york', resolveCdnOptions({ cdnBaseUrl: geoCdnUrl }));
    expect(feature?.geometry).toBeTruthy();
  });
});
