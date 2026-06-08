import { describe, expect, it } from 'vitest';
import {
  globeCountiesBulkUrl,
  globeCountyShapeUrl,
  globeStateCitiesBulkUrl,
  globeStateCitiesCatalogUrl,
  globeStatesBulkUrl,
  countiesBulkUrl,
  countyShapeUrl,
} from '../../src/cdn/paths';
import {
  globeCountiesBulkUrl as cdnCountiesBulkUrl,
  globeCountyShapeUrl as cdnCountyShapeUrl,
  globeStateCitiesBulkUrl as cdnStateCitiesBulkUrl,
  globeStateCitiesCatalogUrl as cdnStateCitiesCatalogUrl,
  globeStatesBulkUrl as cdnStatesBulkUrl,
  resolveGlobeCdnUrl as cdnResolveGlobeCdnUrl,
} from '@twinfile/cdn/paths';

describe('geokit/cdn paths parity with @twinfile/cdn/paths', () => {
  const base = 'https://cdn.test';

  it('matches county and bulk path builders', () => {
    expect(globeCountyShapeUrl('36047')).toBe(cdnCountyShapeUrl('36047'));
    expect(globeCountiesBulkUrl()).toBe(cdnCountiesBulkUrl());
    expect(globeStatesBulkUrl()).toBe(cdnStatesBulkUrl());
    expect(globeStateCitiesBulkUrl('ny')).toBe(cdnStateCitiesBulkUrl('ny'));
    expect(globeStateCitiesCatalogUrl('ny')).toBe(cdnStateCitiesCatalogUrl('ny'));
  });

  it('matches resolved URLs', () => {
    expect(countyShapeUrl(base, '36047')).toBe(
      cdnResolveGlobeCdnUrl(base, cdnCountyShapeUrl('36047'))
    );
    expect(countiesBulkUrl(base)).toBe(cdnResolveGlobeCdnUrl(base, cdnCountiesBulkUrl()));
  });
});
