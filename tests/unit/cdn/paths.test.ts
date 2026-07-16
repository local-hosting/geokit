import { describe, expect, it } from 'vitest';
import {
  globeCountiesBulkUrl,
  globeCountyShapeUrl,
  globeStateCitiesBulkUrl,
  globeStateCitiesCatalogUrl,
  globeStatesBulkUrl,
  globeStateShapeUrl,
  globeStateCountiesShardUrl,
  globeCountyClusterShardUrl,
  globeCellBundleUrl,
  globeCellLayerCatalogUrl,
  countiesBulkUrl,
  countyShapeUrl,
  resolveGlobeCdnUrl,
} from '../../../src/cdn/paths';

describe('geokit/cdn paths', () => {
  const base = 'https://cdn.test';

  it('builds canonical Globe CDN path segments', () => {
    expect(globeCountyShapeUrl('36047')).toBe('/us/county/36047');
    expect(globeCountiesBulkUrl()).toBe('/us/indexes/counties.json');
    expect(globeStatesBulkUrl()).toBe('/us/indexes/states.json');
    expect(globeStateShapeUrl('tx')).toBe('/us/state/tx.json');
    expect(globeStateCountiesShardUrl('tx')).toBe('/us/state/tx/counties.json');
    expect(globeCountyClusterShardUrl('84489e3', 4)).toBe('/us/county/clusters/r4/84489e3.json');
    expect(globeCellBundleUrl('84489e3')).toBe('/cell/84489e3.json');
    expect(globeCellLayerCatalogUrl()).toBe('/cell/layers/index.json');
    expect(globeStateCitiesBulkUrl('ny')).toBe('/us/state/ny/cities');
    expect(globeStateCitiesCatalogUrl('ny')).toBe('/us/state/ny/cities-index.json');
  });

  it('resolves absolute CDN URLs', () => {
    expect(countyShapeUrl(base, '36047')).toBe(
      resolveGlobeCdnUrl(base, globeCountyShapeUrl('36047'))
    );
    expect(countiesBulkUrl(base)).toBe(resolveGlobeCdnUrl(base, globeCountiesBulkUrl()));
    expect(countyShapeUrl(base, '36047')).toBe('https://cdn.test/us/county/36047');
    expect(countiesBulkUrl(base)).toBe('https://cdn.test/us/indexes/counties.json');
  });
});
