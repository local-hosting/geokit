import type { DMA, GeoRef } from '../../types/geo-identity';
import { asGeohashPoint, asH3Point } from '../spatial/constructors';
import {
  asCountryCode,
  asCountyFips,
  asDmaSlug,
  asPlaceKey,
  asZipCode,
} from './constructors';
import { placeKeyFromStateAndSlug } from './normalize';

const H3_INDEX_HEX_LEN = 15;

function expandH3CellId(cellId: string): string {
  const normalized = cellId.trim().toLowerCase();
  if (normalized.length >= H3_INDEX_HEX_LEN) {
    return normalized.slice(0, H3_INDEX_HEX_LEN);
  }
  return normalized.padEnd(H3_INDEX_HEX_LEN, 'f');
}

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
