import { calculateCenterAndZoom } from '@twinfile/geokit/bounds';
import { boundsFromFeature } from '../../cdn/bounds.js';
import { fetchCountyShapeFeature, resolveUsCountyShapeFeature } from '../../cdn/county.js';
import { resolveDmaMarketFromCatalog } from '../../cdn/dma-catalog.js';
import { resolveDmaShapeFromQuery } from '../../cdn/dma.js';
import type { GlobeCdnFetchOptions } from '../../cdn/fetch.js';
import { resolveUsStateShapeFeature } from '../../cdn/state.js';
import { fetchZipFeature } from '../../cdn/zip.js';
import { fetchStatePlaceFeature } from '../../cdn/place.js';
import { BOROUGH_COUNTY_ALIASES } from '../../cdn/resolve-shape.js';
import { slugify } from '../../utils/normalize/index.js';
import type { ResolvedMapPlace } from '../../types/mcp-business.js';
import type { MapHostRegionLayer } from '../../types/mcp-map.js';
import { normalizeCountyFips } from '../../cdn/county.js';
import { dmaSlugFromQuery } from '../../cdn/dma.js';

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

const US_PLACE_TYPES = new Set(['place', 'locality', 'municipality']);

export function isUsPlaceGeocode(feature: ShowMapGeocodeFeature): boolean {
  const props = feature.properties ?? {};
  if (props.country_code?.toLowerCase() !== 'us') return false;
  if (isUsStateGeocode(feature) || isUsCountyGeocode(feature) || isUsZipGeocode(feature)) {
    return false;
  }
  return Boolean(feature.place_type?.some((type) => US_PLACE_TYPES.has(type)));
}

export type ResolvedPlaceRef = { state: string; slug: string };
function stateSlugFromFeature(feature: GeoJSON.Feature): string | null {
  const props = feature.properties ?? {};
  const code = String(props.stateCode ?? props.STUSPS ?? props.stusps ?? props.state ?? '')
    .trim()
    .toLowerCase();
  return /^[a-z]{2}$/.test(code) ? code : null;
}

function countyFipsFromFeature(feature: GeoJSON.Feature): string | null {
  const fips = String((feature.properties as { fips?: string } | undefined)?.fips ?? '').trim();
  return fips ? normalizeCountyFips(fips) : null;
}

function placeNameFromGeocode(feature: ShowMapGeocodeFeature, query: string): string {
  const raw = feature.matching_text ?? feature.text ?? '';
  if (raw.trim()) return raw.trim();
  const head = query.split(',')[0]?.trim();
  return head || query.trim();
}

function placeSlugCandidates(placeName: string): string[] {
  const trimmed = placeName.trim();
  const candidates = [
    slugify(trimmed),
    trimmed.toLowerCase().replace(/\s+/g, '-'),
    trimmed.toLowerCase(),
  ];
  return [...new Set(candidates.filter(Boolean))];
}

async function stateCodeFromGeocodeContext(
  feature: ShowMapGeocodeFeature,
  cdnOptions: GlobeCdnFetchOptions
): Promise<string | null> {
  const hint = stateHintFromGeocodeContext(feature);
  if (!hint) return null;

  const normalizedHint = hint.trim().toLowerCase();
  if (/^[a-z]{2}$/.test(normalizedHint)) {
    return normalizedHint;
  }

  const stateFeature = await resolveUsStateShapeFeature(hint, cdnOptions);
  const props = (stateFeature?.properties ?? {}) as {
    stateCode?: string;
    STUSPS?: string;
    stusps?: string;
  };
  const code = String(props.stateCode ?? props.STUSPS ?? props.stusps ?? '')
    .trim()
    .toLowerCase();
  return /^[a-z]{2}$/.test(code) ? code : null;
}

async function resolveUsPlaceShapeFromGeocode(
  feature: ShowMapGeocodeFeature,
  query: string,
  cdnOptions: GlobeCdnFetchOptions
): Promise<{ geometry: GeoJSON.Geometry; placeRef: ResolvedPlaceRef } | null> {
  const stateCode = await stateCodeFromGeocodeContext(feature, cdnOptions);
  if (!stateCode) return null;

  const placeName = placeNameFromGeocode(feature, query);
  for (const slug of placeSlugCandidates(placeName)) {
    const placeFeature = await fetchStatePlaceFeature(stateCode, slug, cdnOptions);
    if (placeFeature?.geometry) {
      return {
        geometry: placeFeature.geometry,
        placeRef: { state: stateCode, slug },
      };
    }
  }

  for (const slug of placeSlugCandidates(placeName)) {
    const borough = BOROUGH_COUNTY_ALIASES[slug];
    if (!borough || borough.state !== stateCode) continue;
    const countyFeature = await fetchCountyShapeFeature(borough.countyFips, cdnOptions);
    if (countyFeature?.geometry) {
      return {
        geometry: countyFeature.geometry,
        placeRef: { state: stateCode, slug },
      };
    }
  }

  return null;
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
): Promise<{
  place: ResolvedMapPlace;
  regionGeometry: GeoJSON.Geometry;
  regionLayer: MapHostRegionLayer;
} | null> {
  const feature = await fetchZipFeature(zip, cdnOptions);
  if (!feature?.geometry) return null;
  const place = placeFromShapeFeature(`${zip}, United States`, feature);
  if (!place) return null;
  return { place, regionGeometry: feature.geometry, regionLayer: { dataset: 'zip', slug: zip } };
}

async function resolveDmaShowMap(
  query: string,
  cdnOptions: GlobeCdnFetchOptions
): Promise<{
  place: ResolvedMapPlace;
  regionGeometry: GeoJSON.Geometry;
  regionLayer: MapHostRegionLayer;
} | null> {
  const feature = await resolveDmaShapeFromQuery(query, cdnOptions);
  if (!feature?.geometry) return null;
  const slug = query.replace(/\bdma\b/gi, ' ').trim();
  const label = /\bdma\b/i.test(query) ? query.trim() : `${query.trim()} DMA`;
  const place = placeFromShapeFeature(label || `${slug} DMA`, feature);
  if (!place) return null;
  const dmaSlug = dmaSlugFromQuery(query);
  if (!dmaSlug) return null;

  const catalogMarket = await resolveDmaMarketFromCatalog(dmaSlug, cdnOptions);
  return {
    place,
    regionGeometry: feature.geometry,
    regionLayer: {
      dataset: 'dma',
      slug: catalogMarket?.slug ?? dmaSlug,
      region: catalogMarket?.region,
    },
  };
}

type ResolvedRegionShape = {
  geometry?: GeoJSON.Geometry;
  placeRef?: ResolvedPlaceRef;
  regionLayer?: MapHostRegionLayer;
};

async function resolveGeocodedRegionGeometry(
  query: string,
  feature: ShowMapGeocodeFeature,
  cdnOptions: GlobeCdnFetchOptions
): Promise<ResolvedRegionShape> {
  if (isUsStateGeocode(feature)) {
    const hint = feature.text?.trim() || query.trim();
    const stateFeature = await resolveUsStateShapeFeature(hint, cdnOptions);
    const slug = stateFeature ? stateSlugFromFeature(stateFeature) : null;
    return {
      geometry: stateFeature?.geometry ?? undefined,
      regionLayer: slug ? { dataset: 'state', slug } : undefined,
    };
  }

  if (isUsCountyGeocode(feature)) {
    const stateHint = stateHintFromGeocodeContext(feature);
    if (!stateHint) return {};
    const countyFeature = await resolveUsCountyShapeFeature(
      countyNameFromGeocode(feature),
      stateHint,
      cdnOptions
    );
    const fips = countyFeature ? countyFipsFromFeature(countyFeature) : null;
    return {
      geometry: countyFeature?.geometry ?? undefined,
      regionLayer: fips ? { dataset: 'county', fips } : undefined,
    };
  }

  if (isUsZipGeocode(feature)) {
    const zip = feature.text?.trim() || parseUsZipHint(query);
    if (!zip) return {};
    const zipFeature = await fetchZipFeature(zip, cdnOptions);
    return {
      geometry: zipFeature?.geometry ?? undefined,
      regionLayer: zip ? { dataset: 'zip', slug: zip } : undefined,
    };
  }

  if (isUsPlaceGeocode(feature)) {
    const placeShape = await resolveUsPlaceShapeFromGeocode(feature, query, cdnOptions);
    if (!placeShape) return {};
    return {
      geometry: placeShape.geometry,
      placeRef: placeShape.placeRef,
      regionLayer: {
        dataset: 'place',
        state: placeShape.placeRef.state,
        slug: placeShape.placeRef.slug,
      },
    };
  }

  return {};
}

export async function resolveShowMapRegionContext(
  query: string,
  feature: ShowMapGeocodeFeature | undefined,
  place: ResolvedMapPlace,
  cdnOptions: GlobeCdnFetchOptions
): Promise<{
  place: ResolvedMapPlace;
  regionGeometry?: GeoJSON.Geometry;
  placeRef?: ResolvedPlaceRef;
  regionLayer?: MapHostRegionLayer;
}> {
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

  const {
    geometry: regionGeometry,
    placeRef,
    regionLayer,
  } = await resolveGeocodedRegionGeometry(trimmed, feature, cdnOptions);
  if (!regionGeometry) {
    return { place };
  }

  const shaped = placeFromShapeFeature(place.label, {
    type: 'Feature',
    geometry: regionGeometry,
    properties: {},
  });

  return { place: shaped ?? place, regionGeometry, placeRef, regionLayer };
}
