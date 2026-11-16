import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadUsCrosswalkSync } from '../src/load/load';
import { convert, geohashForZip, h3ForZip, crosswalk, zipsInDma, GKPoint, GKZip, GKDMA, GKH3, GKGeohash, GKPlace } from '../src/index.ts';
import { GeoKind, type DMA } from '@doppler-group/geokit/core';
import { ensureH3Projection } from '../src/h3/project';
import { loadUsCrosswalk, resetCrosswalkForTest } from '../src/load/load';
import {
  getLoadedCrosswalkTableNames,
  isCrosswalkTableLoaded,
  US_CROSSWALK_PRESETS,
  slugToDmaDisplayName,
} from '../src/index.ts';

const ROOT = dirname(fileURLToPath(import.meta.url));

describe('@doppler-group/geokit/crosswalk', () => {
  it('loads US tables and crosswalks Indianapolis', async () => {
    loadUsCrosswalkSync();
    await ensureH3Projection();

    const h3 = h3ForZip('46204');
    expect(h3).toBeTruthy();

    const result = crosswalk(GKPoint(39.7684, -86.1581));
    expect(result.country[0]).toBe('us');
    expect(result.h3?.[0]).toBeTruthy();
    expect(result.geohash?.[0]).toBeTruthy();
    expect(result.zip?.length).toBeGreaterThan(0);
    expect(result.state?.[0]).toBe('in');
  });


  it('convert uses GeoKind for typed DMA output', () => {
    loadUsCrosswalkSync();
    const kind = GeoKind.DMA;
    const dma = convert(GKZip('46204'), kind);
    const _typed: DMA | undefined = dma;
    expect(_typed?.slug).toBe('indianapolis');
  });

  it('dma input returns many zips', () => {
    loadUsCrosswalkSync();
    const indyZips = zipsInDma('indianapolis');
    expect(indyZips.length).toBeGreaterThan(0);
    const result = crosswalk(GKDMA('indianapolis'), { to: [GeoKind.Zip, GeoKind.DMA] });
    expect(result.dma).toEqual([{ slug: 'indianapolis', region: expect.any(String) }]);
    expect(result.zip?.length).toBeGreaterThan(0);
  });


  it('crosswalks from geohash input', async () => {
    loadUsCrosswalkSync();
    await ensureH3Projection();

    const geohash = geohashForZip('46204');
    expect(geohash).toBeTruthy();

    const result = crosswalk(GKGeohash(geohash!), { to: [GeoKind.Geohash, GeoKind.Zip, GeoKind.DMA, GeoKind.State] });
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
      GKZip('46204'),
      { spine: 'geohash', to: [GeoKind.Geohash, GeoKind.Zip, GeoKind.DMA, GeoKind.State] }
    );
    expect(result.geohash?.[0]).toBe(geohash);
    expect(result.zip?.length).toBeGreaterThan(0);
    expect(result.dma?.[0]?.slug).toBe('indianapolis');
    expect(result.state?.[0]).toBe('in');
  });

  it('convert from geohash returns DMA when geohash-to-dma has coverage', () => {
    loadUsCrosswalkSync();
    const geohash = geohashForZip('46204');
    expect(geohash).toBeTruthy();
    const dma = convert(GKGeohash(geohash!), GeoKind.DMA);
    expect(dma?.slug).toBe('indianapolis');
  });

  it('convert from zip returns DMA when h3-to-dma has coverage', () => {
    loadUsCrosswalkSync();
    const dma = convert(GKZip('46204'), GeoKind.DMA);
    if (dma) expect(dma.slug).toBeTruthy();
  });

  it('selective load loads only requested tables', async () => {
    resetCrosswalkForTest();
    await loadUsCrosswalk({ tables: US_CROSSWALK_PRESETS.dma, projectH3: false });

    expect(isCrosswalkTableLoaded('h3ToDma')).toBe(true);
    expect(isCrosswalkTableLoaded('h3R5ToZips')).toBe(false);
    expect(getLoadedCrosswalkTableNames()).toEqual(['h3ToDma']);

    const dma = convert(GKH3('8526690fffffffff'), GeoKind.DMA);
    expect(dma?.slug).toBe('bowling-green');
  });

  it('selective load merges additional tables on subsequent calls', async () => {
    resetCrosswalkForTest();
    await loadUsCrosswalk({ tables: US_CROSSWALK_PRESETS.dma, projectH3: false });
    await loadUsCrosswalk({ tables: US_CROSSWALK_PRESETS.h3Zip, projectH3: false });

    expect(isCrosswalkTableLoaded('h3ToDma')).toBe(true);
    expect(isCrosswalkTableLoaded('h3R5ToZips')).toBe(true);
    expect(getLoadedCrosswalkTableNames()).toEqual(['h3ToDma', 'h3R5ToZips']);
  });

  it('resolves place key to dma', async () => {
    resetCrosswalkForTest();
    await loadUsCrosswalk({ tables: US_CROSSWALK_PRESETS.place, projectH3: false });

    const result = crosswalk(GKPlace('ak/dillingham'), { to: [GeoKind.DMA] });
    expect(result.dma).toEqual([{ slug: 'anchorage', region: 'unknown' }]);
  });

  it('exposes dma table helpers for bulk shard builds', async () => {
    resetCrosswalkForTest();
    await loadUsCrosswalk({
      tables: [...US_CROSSWALK_PRESETS.demographicsShard, 'countyToDma'],
      projectH3: false,
    });

    const {
      crosswalkTableNameFromStem,
      fipsToDmaAssignments,
      isKnownDmaSlug,
      listDmaSlugs,
      zipToH3R5Table,
    } = await import('../src/index.ts');

    expect(crosswalkTableNameFromStem('dma-to-zips')).toBe('dmaToZips');
    expect(listDmaSlugs()).toContain('indianapolis');
    expect(isKnownDmaSlug('indianapolis')).toBe(true);
    expect(isKnownDmaSlug('not-a-market')).toBe(false);
    expect(Object.keys(zipToH3R5Table()).length).toBeGreaterThan(0);
    expect(slugToDmaDisplayName('hartford-new-haven')).toBe('Hartford & New Haven, CT');

    const assignments = fipsToDmaAssignments();
    expect(assignments.get('18097')?.dmaSlug).toBe('indianapolis');
    expect(assignments.get('18097')?.dmaName).toBeTruthy();
  });
});

describe('crosswalk guard', () => {
  it('only imports allowed @doppler-group/geokit/core subpaths in src', () => {
    const srcDir = join(ROOT, '../src');
    const files = walk(srcDir);
    const allowedCoreImports = /^@twinfile\/geokit\/core(?:\/(?:containment|geohash))?$/;
    for (const file of files) {
      if (!file.endsWith('.ts')) continue;
      const text = readFileSync(file, 'utf8');
      const imports = [...text.matchAll(/from ['"](@twinfile\/geokit\/core(?:\/[^'"]+)?)['"]/g)].map((m) => m[1]);
      for (const specifier of imports) {
        expect(specifier).toMatch(allowedCoreImports);
      }
    }
  });

  it('package.json has only workspace geokit runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, '../package.json'), 'utf8'));
    expect(pkg.dependencies ?? {}).toEqual({});
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
