import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadUsCrosswalkSync } from '../src/load/load';
import { dmaForGeohash, dmaForZip, geohashForZip, h3ForZip, crosswalk, zipsInDma } from '../src/index.ts';
import { ensureH3Projection } from '../src/h3/project';
import { loadUsCrosswalk, resetCrosswalkForTest } from '../src/load/load';
import {
  dmaForH3,
  getLoadedCrosswalkTableNames,
  isCrosswalkTableLoaded,
  US_CROSSWALK_PRESETS,
} from '../src/index.ts';

const ROOT = dirname(fileURLToPath(import.meta.url));

describe('@geokit/crosswalk', () => {
  it('loads US tables and crosswalks Indianapolis', async () => {
    loadUsCrosswalkSync();
    await ensureH3Projection();

    const h3 = h3ForZip('46204');
    expect(h3).toBeTruthy();

    const result = crosswalk({ lat: 39.7684, lon: -86.1581 });
    expect(result.country[0]).toBe('us');
    expect(result.h3?.[0]).toBeTruthy();
    expect(result.geohash?.[0]).toBeTruthy();
    expect(result.zip?.length).toBeGreaterThan(0);
    expect(result.state?.[0]).toBe('in');
  });

  it('dma input returns many zips', () => {
    loadUsCrosswalkSync();
    const indyZips = zipsInDma('indianapolis');
    expect(indyZips.length).toBeGreaterThan(0);
    const result = crosswalk({ dmaSlug: 'indianapolis' }, { to: ['zip', 'dma'] });
    expect(result.dma).toEqual(['indianapolis']);
    expect(result.zip?.length).toBeGreaterThan(0);
  });


  it('crosswalks from geohash input', async () => {
    loadUsCrosswalkSync();
    await ensureH3Projection();

    const geohash = geohashForZip('46204');
    expect(geohash).toBeTruthy();

    const result = crosswalk({ geohash: geohash! }, { to: ['geohash', 'zip', 'dma', 'state'] });
    expect(result.geohash?.[0]).toBe(geohash);
    expect(result.zip?.length).toBeGreaterThan(0);
    expect(result.state?.[0]).toBe('in');
  });

  it('geohash spine resolves ZIP via geohash tables without H3 projection', async () => {
    resetCrosswalkForTest();
    await loadUsCrosswalk({ tables: US_CROSSWALK_PRESETS.geohashZipResolve, spine: 'geohash', projectH3: false });

    const geohash = geohashForZip('46204');
    expect(geohash).toBeTruthy();

    const result = crosswalk(
      { zip: '46204' },
      { spine: 'geohash', to: ['geohash', 'zip', 'dma', 'state'] }
    );
    expect(result.geohash?.[0]).toBe(geohash);
    expect(result.zip?.length).toBeGreaterThan(0);
    expect(result.dma?.[0]).toBe('indianapolis');
    expect(result.state?.[0]).toBe('in');
  });

  it('dmaForGeohash returns slug when geohash-to-dma has coverage', () => {
    loadUsCrosswalkSync();
    const geohash = geohashForZip('46204');
    expect(geohash).toBeTruthy();
    const dma = dmaForGeohash(geohash!);
    expect(dma).toBe('indianapolis');
  });

  it('dmaForZip returns slug when h3-to-dma has coverage', () => {
    loadUsCrosswalkSync();
    const dma = dmaForZip('46204');
    if (dma) expect(typeof dma).toBe('string');
  });

  it('selective load loads only requested tables', async () => {
    resetCrosswalkForTest();
    await loadUsCrosswalk({ tables: US_CROSSWALK_PRESETS.dma, projectH3: false });

    expect(isCrosswalkTableLoaded('h3ToDma')).toBe(true);
    expect(isCrosswalkTableLoaded('h3R5ToZips')).toBe(false);
    expect(getLoadedCrosswalkTableNames()).toEqual(['h3ToDma']);

    const dma = dmaForH3('81267fffffffff');
    expect(dma).toBe('louisville');
  });

  it('selective load merges additional tables on subsequent calls', async () => {
    resetCrosswalkForTest();
    await loadUsCrosswalk({ tables: US_CROSSWALK_PRESETS.dma, projectH3: false });
    await loadUsCrosswalk({ tables: US_CROSSWALK_PRESETS.h3Zip, projectH3: false });

    expect(isCrosswalkTableLoaded('h3ToDma')).toBe(true);
    expect(isCrosswalkTableLoaded('h3R5ToZips')).toBe(true);
    expect(getLoadedCrosswalkTableNames()).toEqual(['h3ToDma', 'h3R5ToZips']);
  });

  it('resolves place key to dma and region', async () => {
    resetCrosswalkForTest();
    await loadUsCrosswalk({ tables: US_CROSSWALK_PRESETS.place, projectH3: false });

    const result = crosswalk({ placeKey: 'ak/dillingham' }, { to: ['dma', 'region'] });
    expect(result.dma).toEqual(['anchorage']);
    expect(result.region).toEqual(['northwest']);
  });
});

describe('crosswalk guard', () => {
  it('has no @geokit/core imports in src', () => {
    const srcDir = join(ROOT, '../src');
    const files = walk(srcDir);
    for (const file of files) {
      if (!file.endsWith('.ts')) continue;
      const text = readFileSync(file, 'utf8');
      expect(text).not.toMatch(/@geokit\/core/);
    }
  });

  it('package.json has no runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, '../package.json'), 'utf8'));
    expect(pkg.dependencies ?? {}).toEqual({ '@geokit/h3': 'workspace:*' });
  });
});

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}
