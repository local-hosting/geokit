import type { DMA, GeoRef } from '../../types/geo-identity';
import { asGeohashPoint, asH3Point } from '../spatial/constructors';
import {
  asCountryCode,
  asCountyFips,
  asDmaSlug,
  asPlaceKey,
  asZipCode,
} from './constructors';
import { expandH3CellId } from '../h3/cell-id';
import { placeKeyFromStateAndSlug } from './normalize';

/** WGS84 coordinate → {@link GeoRef} point. */
export function GKPoint(lat: number, lon: number): Extract<GeoRef, { kind: 'point' }> {
  return { kind: 'point', value: [lat, lon] };
}

/** ZIP code → {@link GeoRef} zip. */
export function GKZip(raw: string): Extract<GeoRef, { kind: 'zip' }> {
  return { kind: 'zip', value: asZipCode(raw) };
}

/** Nielsen DMA slug → {@link GeoRef} dmaSlug. */
export function GKDMA(raw: string): Extract<GeoRef, { kind: 'dmaSlug' }> {
  return { kind: 'dmaSlug', value: asDmaSlug(raw) };
}

/** Full {@link DMA} record → {@link GeoRef} dma. */
export function GKDMARecord(dma: DMA): Extract<GeoRef, { kind: 'dma' }> {
  return { kind: 'dma', value: dma };
}

/** H3 cell → {@link GeoRef} h3. */
export function GKH3(raw: string): Extract<GeoRef, { kind: 'h3' }> {
  return { kind: 'h3', value: asH3Point(expandH3CellId(raw)) };
}

/** Geohash cell → {@link GeoRef} geohash. */
export function GKGeohash(raw: string): Extract<GeoRef, { kind: 'geohash' }> {
  return { kind: 'geohash', value: asGeohashPoint(raw) };
}

/** County FIPS → {@link GeoRef} county. */
export function GKCounty(raw: string): Extract<GeoRef, { kind: 'county' }> {
  return { kind: 'county', value: asCountyFips(raw) };
}

/** Place crosswalk key → {@link GeoRef} place. */
export function GKPlace(raw: string): Extract<GeoRef, { kind: 'place' }> {
  return { kind: 'place', value: asPlaceKey(raw) };
}

export function GKPlaceInState(
  state: string,
  placeSlug: string
): Extract<GeoRef, { kind: 'place' }> {
  const key = placeKeyFromStateAndSlug(state, placeSlug);
  if (!key) throw new Error(`Invalid place: ${state}/${placeSlug}`);
  return GKPlace(key);
}

/** Country code → {@link GeoRef} country. */
export function GKCountry(raw: string): Extract<GeoRef, { kind: 'country' }> {
  return { kind: 'country', value: asCountryCode(raw) };
}


/** Census tract GEOID (11-digit) → {@link GeoRef} tract. */
export function GKTract(raw: string): Extract<GeoRef, { kind: 'tract' }> {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length < 10) {
    throw new Error(`tract GEOID must be at least 10 digits, got "${raw}"`);
  }
  return { kind: 'tract', value: trimmed.padStart(11, '0').slice(0, 11) };
}
