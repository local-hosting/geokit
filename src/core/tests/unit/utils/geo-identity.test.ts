import { describe, expect, it } from 'vitest';
import {
  asDMA,
  asDmaSlug,
  asDmaSlugOrUndefined,
  asZipCode,
  asMacroRegion,
  parseGeoRef,
  GKPoint,
  GKZip,
} from '../../../src/utils/geo-identity';

describe('geo-identity', () => {
  it('normalizes DMA slugs', () => {
    expect(asDmaSlugOrUndefined('Indianapolis')).toBe('indianapolis');
    expect(asDmaSlug('laredo')).toBe('laredo');
  });

  it('normalizes ZIP codes', () => {
    expect(asZipCode('46204')).toBe('46204');
    expect(asZipCode('240')).toBe('00240');
  });

  it('builds DMA records', () => {
    const dma = asDMA(asDmaSlug('indianapolis'), asMacroRegion('midwest'));
    expect(dma.slug).toBe('indianapolis');
    expect(dma.region).toBe('midwest');
  });

  it('GK* GeoRef factories build tagged refs', () => {
    expect(GKPoint(39.76, -86.15)).toEqual({ kind: 'point', value: [39.76, -86.15] });
    expect(GKZip('46204').value).toBe('46204');
  });
});
