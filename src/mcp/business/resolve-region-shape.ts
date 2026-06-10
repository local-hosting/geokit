import { calculateCenterAndZoom } from '@twinfile/geokit/bounds';
import { boundsFromFeature } from '../../cdn/bounds.js';
import { resolveUsCountyShapeFeature } from '../../cdn/county.js';
import { resolveDmaShapeFromQuery } from '../../cdn/dma.js';
import type { GlobeCdnFetchOptions } from '../../cdn/fetch.js';
import { resolveUsStateShapeFeature } from '../../cdn/state.js';
import { fetchZipFeature } from '../../cdn/zip.js';
import type { ResolvedMapPlace } from '../../types/mcp-business.js';

export type ShowMapGeocodeFeature = GeoJSON.Feature & {
  bbox?: [number, number, number, number];
  place_type?: string[];
  place_name?: string;
  text?: string;
  matching_text?: string;
  properties?: {
    country_code?: string;
    place_designation?: string;
    [key: string]: unknown;
  };
  context?: Array<{
    id?: string;
    text?: string;
    country_code?: string;
    place_designation?: string;
  }>;
};

const US_ZIP_QUERY =
  /^\s*(\d{5})(?:-\d{4})?\s*(?:,?\s*(?:usa|u\.s\.a?\.?|united states(?:\s+of\s+america)?))?\s*$/i;

export function parseUsZipHint(query: string): string | null {
  const match = query.trim().match(US_ZIP_QUERY);
  return match?.[1] ?? null;
}

export function isUsStateGeocode(feature: ShowMapGeocodeFeature): boolean {
  const props = feature.properties ?? {};
  return (
    props.country_code?.toLowerCase() === 'us' &&
    props.place_designation === 'state' &&
    Boolean(feature.place_type?.includes('region'))
  );
}

export function isUsCountyGeocode(feature: ShowMapGeocodeFeature): boolean {
  const props = feature.properties ?? {};
  return (
    props.country_code?.toLowerCase() === 'us' &&
    props.place_designation === 'county' &&
    Boolean(feature.place_type?.includes('county'))
  );
}

export function isUsZipGeocode(feature: ShowMapGeocodeFeature): boolean {
  return (
    Boolean(feature.place_type?.includes('postal_code')) &&
    feature.properties?.country_code?.toLowerCase() === 'us'
  );
}

function normalizeCountyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+(county|parish|borough)$/i, '');
}

function stateHintFromGeocodeContext(feature: ShowMapGeocodeFeature): string | null {
  for (const ctx of feature.context ?? []) {
    if (ctx.place_designation === 'state' && ctx.country_code?.toLowerCase() === 'us') {
      return ctx.text?.trim() ?? null;
    }
  }
  return null;
}

function countyNameFromGeocode(feature: ShowMapGeocodeFeature): string {
  const raw = feature.matching_text ?? feature.text ?? '';
  return normalizeCountyName(raw);
}

function placeFromShapeFeature(label: string, feature: GeoJSON.Feature): ResolvedMapPlace | null {
  const bounds = boundsFromFeature(feature);
  if (!bounds) return null;
  const center = calculateCenterAndZoom(bounds);
  if (!center) return null;
  return {
    lat: center.lat,
    lng: center.lng,
    label,
    bounds,
    scope: 'region',
  };
}

async function resolveZipShowMap(
  zip: string,
  cdnOptions: GlobeCdnFetchOptions
): Promise<{ place: ResolvedMapPlace; regionGeometry: GeoJSON.Geometry } | null> {
  const feature = await fetchZipFeature(zip, cdnOptions);
  if (!feature?.geometry) return null;
  const place = placeFromShapeFeature(`${zip}, United States`, feature);
  if (!place) return null;
  return { place, regionGeometry: feature.geometry };
}

async function resolveDmaShowMap(
  query: string,
  cdnOptions: GlobeCdnFetchOptions
): Promise<{ place: ResolvedMapPlace; regionGeometry: GeoJSON.Geometry } | null> {
  const feature = await resolveDmaShapeFromQuery(query, cdnOptions);
  if (!feature?.geometry) return null;
  const slug = query.replace(/\bdma\b/gi, ' ').trim();
  const label = /\bdma\b/i.test(query) ? query.trim() : `${query.trim()} DMA`;
  const place = placeFromShapeFeature(label || `${slug} DMA`, feature);
  if (!place) return null;
  return { place, regionGeometry: feature.geometry };
}

async function resolveGeocodedRegionGeometry(
  query: string,
  feature: ShowMapGeocodeFeature,
  cdnOptions: GlobeCdnFetchOptions
): Promise<GeoJSON.Geometry | undefined> {
  if (isUsStateGeocode(feature)) {
    const hint = feature.text?.trim() || query.trim();
    const stateFeature = await resolveUsStateShapeFeature(hint, cdnOptions);
    return stateFeature?.geometry ?? undefined;
  }

  if (isUsCountyGeocode(feature)) {
    const stateHint = stateHintFromGeocodeContext(feature);
    if (!stateHint) return undefined;
    const countyFeature = await resolveUsCountyShapeFeature(
      countyNameFromGeocode(feature),
      stateHint,
      cdnOptions
    );
    return countyFeature?.geometry ?? undefined;
  }

  if (isUsZipGeocode(feature)) {
    const zip = feature.text?.trim() || parseUsZipHint(query);
    if (!zip) return undefined;
    const zipFeature = await fetchZipFeature(zip, cdnOptions);
    return zipFeature?.geometry ?? undefined;
  }

  return undefined;
}

export async function resolveShowMapRegionContext(
  query: string,
  feature: ShowMapGeocodeFeature | undefined,
  place: ResolvedMapPlace,
  cdnOptions: GlobeCdnFetchOptions
): Promise<{ place: ResolvedMapPlace; regionGeometry?: GeoJSON.Geometry }> {
  const trimmed = query.trim();
  const zipHint = parseUsZipHint(trimmed);
  if (zipHint) {
    const zipContext = await resolveZipShowMap(zipHint, cdnOptions);
    if (zipContext) return zipContext;
  }

  const dmaContext = await resolveDmaShowMap(trimmed, cdnOptions);
  if (dmaContext) return dmaContext;

  if (place.scope !== 'region' || !feature) {
    return { place };
  }

  const regionGeometry = await resolveGeocodedRegionGeometry(trimmed, feature, cdnOptions);
  if (!regionGeometry) {
    return { place };
  }

  return { place, regionGeometry };
}
