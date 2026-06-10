import type { FeatureCollection } from 'geojson';
import type { Bounds } from '@twinfile/geokit/types';
import { dmaSlugFromQuery } from '../../cdn/dma.js';
import { formatDmaCatalogSuggestions, resolveDmaCatalogSlug } from '../../cdn/dma-catalog.js';
import { ensureGlobeCdnJwt, isGlobeCdnAuthConfigured } from '../resolve-globe-cdn-auth.js';
import { resolveGlobeCdnFetchOptions } from '../globe-cdn-fetch-options.js';
import { resolveShowMapRegionContext, type ResolvedPlaceRef } from './resolve-region-shape.js';
import type { MapHostRegionLayer } from '../../types/mcp-map.js';
import type { ResolvedMapPlace, ResolvedPlace } from '../../types/mcp-business.js';
import { fetchGeocode } from './api-fetch.js';

type GeocodeFeature = GeoJSON.Feature & {
  bbox?: [number, number, number, number];
  place_type?: string[];
  place_name?: string;
  name?: string;
  label?: string;
  text?: string;
  properties?: {
    country_code?: string;
    place_designation?: string;
    [key: string]: unknown;
  };
};

/** Place types that should frame an area, not a pin marker. */
const REGION_PLACE_TYPES = new Set([
  'country',
  'region',
  'county',
  'subregion',
  'municipality',
  'place',
  'locality',
  'postal_code',
]);

/** Continental US framing when geocoding returns only a centroid. */
export const CONUS_BOUNDS: Bounds = [-125, 24, -66, 50];

const US_COUNTRY_QUERY = /^(us|usa|u\.s\.?a?\.?|united states(?:\s+of\s+america)?|america)$/i;

function labelFromFeature(feature: GeocodeFeature, fallback: string): string {
  const props = feature.properties ?? {};
  const candidate =
    feature.place_name ??
    (props.place_name as string | undefined) ??
    feature.text ??
    (props.name as string | undefined) ??
    (props.label as string | undefined);
  return candidate?.trim() || fallback;
}

function parseBbox(feature: GeocodeFeature): Bounds | null {
  const bbox = feature.bbox;
  if (!bbox || bbox.length !== 4) {
    return null;
  }
  const minLon = bbox[0];
  const minLat = bbox[1];
  const maxLon = bbox[2];
  const maxLat = bbox[3];
  if (
    ![minLon, minLat, maxLon, maxLat].every(
      (value) => typeof value === 'number' && Number.isFinite(value)
    )
  ) {
    return null;
  }
  if (minLon >= maxLon || minLat >= maxLat) {
    return null;
  }
  return [minLon, minLat, maxLon, maxLat];
}

function isRegionalPlaceType(placeTypes: string[] | undefined): boolean {
  if (!placeTypes?.length) {
    return false;
  }
  return placeTypes.some((type) => REGION_PLACE_TYPES.has(type));
}

export function fallbackBoundsForQuery(query: string): Bounds | null {
  if (US_COUNTRY_QUERY.test(query.trim())) {
    return CONUS_BOUNDS;
  }
  return null;
}

export function placeFromGeocodeResult(
  result: FeatureCollection,
  fallbackLabel: string
): ResolvedMapPlace | null {
  const feature = result.features?.[0] as GeocodeFeature | undefined;
  if (!feature) {
    return null;
  }
  return placeFromGeocodeFeature(feature, fallbackLabel);
}

function placeFromGeocodeFeature(
  feature: GeocodeFeature,
  fallbackLabel: string
): ResolvedMapPlace | null {
  if (!feature.geometry || feature.geometry.type !== 'Point') {
    return null;
  }
  const [lng, lat] = feature.geometry.coordinates;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return null;
  }

  const bounds = parseBbox(feature);
  const regional = bounds != null && isRegionalPlaceType(feature.place_type);

  return {
    lat,
    lng,
    label: labelFromFeature(feature, fallbackLabel),
    bounds: regional ? bounds : undefined,
    scope: regional ? 'region' : 'point',
  };
}

function applyRegionalFallback(place: ResolvedMapPlace, query: string): ResolvedMapPlace {
  if (place.scope === 'point') {
    const fallbackBounds = fallbackBoundsForQuery(query);
    if (fallbackBounds) {
      return {
        ...place,
        bounds: fallbackBounds,
        scope: 'region',
      };
    }
  }
  return place;
}

export async function geocodePlaceQuery(query: string): Promise<ResolvedPlace> {
  const place = await resolveMapPlaceQuery(query);
  return place;
}

function isAllDmaQuery(query: string): boolean {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
  return (
    /^(?:show\s+)?all\s+dmas?(?:\s+markets)?$/.test(normalized) ||
    /^every\s+dma(s)?$/.test(normalized) ||
    /^nielsen\s+dmas?$/.test(normalized)
  );
}

export async function resolveShowMapContext(
  query: string,
  options?: { cdnBaseUrl?: string }
): Promise<{
  place: ResolvedMapPlace;
  regionGeometry?: GeoJSON.Geometry;
  placeRef?: ResolvedPlaceRef;
  regionLayer?: MapHostRegionLayer;
}> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('A place name or address is required.');
  }

  if (isAllDmaQuery(trimmed)) {
    return {
      place: {
        lat: 39.8283,
        lng: -98.5795,
        label: 'All Nielsen DMA markets',
        scope: 'region',
        bounds: CONUS_BOUNDS,
      },
      regionLayer: { dataset: 'dma', mode: 'viewport' },
    };
  }

  await ensureGlobeCdnJwt();
  const cdnOptions = resolveGlobeCdnFetchOptions(options);
  const zipOnly = /^\d{5}(?:-\d{4})?$/.test(trimmed);
  const dmaOnly = /\bdma\b/i.test(trimmed);

  if (!zipOnly && !dmaOnly) {
    const result = await fetchGeocode(trimmed);
    const feature = result.features?.[0] as GeocodeFeature | undefined;
    const place = placeFromGeocodeFeature(feature ?? ({} as GeocodeFeature), trimmed);
    if (!place) {
      throw new Error(`Could not find a location for "${trimmed}".`);
    }
    const resolved = applyRegionalFallback(place, trimmed);
    return resolveShowMapRegionContext(trimmed, feature, resolved, cdnOptions);
  }

  const fallbackPlace: ResolvedMapPlace = {
    lat: 39.8283,
    lng: -98.5795,
    label: trimmed,
    scope: 'region',
    bounds: CONUS_BOUNDS,
  };
  const context = await resolveShowMapRegionContext(trimmed, undefined, fallbackPlace, cdnOptions);
  const dmaSlug = dmaSlugFromQuery(trimmed);
  if (dmaSlug && !context.regionGeometry) {
    if (!isGlobeCdnAuthConfigured()) {
      throw new Error(
        'Globe CDN DMA auth is not configured. Set GLOBE_CDN_JWT or GLOBE_CDN_JWT_SECRET (same secret as mapto.link) in packages/geokit/.env or apps/fieldwise/.env.'
      );
    }

    const catalogMatch = await resolveDmaCatalogSlug(dmaSlug, cdnOptions);
    const suggestions = formatDmaCatalogSuggestions(catalogMatch);
    if (catalogMatch.kind === 'ambiguous' && suggestions.length > 0) {
      throw new Error(
        `DMA "${dmaSlug}" matches multiple markets. Try one of: ${suggestions.map((slug) => `${slug} dma`).join(', ')}.`
      );
    }

    throw new Error(
      `No DMA boundary for "${dmaSlug}". Use a full Nielsen slug from /markets/dma/index.json (e.g. tampa-st-petersburg-sarasota dma).`
    );
  }
  return context;
}

export async function resolveMapPlaceQuery(query: string): Promise<ResolvedMapPlace> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('A place name or address is required.');
  }

  const result = await fetchGeocode(trimmed);
  const place = placeFromGeocodeResult(result as FeatureCollection, trimmed);
  if (!place) {
    throw new Error(`Could not find a location for "${trimmed}".`);
  }

  return applyRegionalFallback(place, trimmed);
}

export async function resolvePlaceInput(args: {
  place?: string;
  lat?: number;
  lng?: number;
}): Promise<ResolvedPlace> {
  if (typeof args.lat === 'number' && typeof args.lng === 'number') {
    const label = args.place?.trim() || `${args.lat.toFixed(4)}, ${args.lng.toFixed(4)}`;
    return { lat: args.lat, lng: args.lng, label };
  }

  if (args.place?.trim()) {
    return geocodePlaceQuery(args.place);
  }

  throw new Error('Provide a place name/address or lat and lng.');
}
