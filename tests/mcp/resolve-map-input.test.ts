// @vitest-environment node

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import dotenv from 'dotenv';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as resolvePlace from '../../src/mcp/business/resolve-place.js';
import { resolveMapViewInput } from '../../src/mcp/resolve-map-input.js';

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
  vi.restoreAllMocks();
});

describe('resolveMapViewInput', () => {
  it('returns lat/lng input unchanged', async () => {
    const input = { lat: 38.25, lng: -85.76 };
    expect(await resolveMapViewInput(input)).toEqual(input);
  });

  it('returns bounds input unchanged', async () => {
    const input = { bounds: [-86, 38, -85, 39] as [number, number, number, number] };
    expect(await resolveMapViewInput(input)).toEqual(input);
  });

  it('throws when no geography or geocode hint is provided', async () => {
    await expect(resolveMapViewInput({})).rejects.toThrow(/place\/query to geocode/);
  });

  it('geocodes a free-text query via show_map resolution', async () => {
    const resolved = await resolveMapViewInput({ query: 'Omaha DMA' });
    expect(resolved.lat).toBeTypeOf('number');
    expect(resolved.lng).toBeTypeOf('number');
    expect(resolved.bounds?.length).toBe(4);
    expect(resolved.regionGeometry).toBeTruthy();
    expect(resolved.regionLayer).toEqual(
      expect.objectContaining({ dataset: 'dma', slug: 'omaha' })
    );
  });

  it('treats place without state as a geocode hint', async () => {
    vi.spyOn(resolvePlace, 'resolveShowMapContext').mockResolvedValue({
      place: {
        lat: 41.1,
        lng: -96.15,
        label: 'Omaha DMA',
        bounds: [-97.83, 40, -94.47, 42.21],
        scope: 'region',
      },
      regionGeometry: { type: 'Polygon', coordinates: [] },
      regionLayer: { dataset: 'dma', slug: 'omaha' },
    });

    const resolved = await resolveMapViewInput({ place: 'Omaha DMA' });
    expect(resolved.bounds?.length).toBe(4);
    expect(resolved.regionLayer?.dataset).toBe('dma');
  });
});
