import type { FeatureCollection } from 'geojson';
import { resolveGeocodingApiKey, resolveRoutingAccessToken } from '../../config/env/index.js';
import type { PlaceSearchResult, ReverseGeocodeResult } from '../../types/mcp-business-api.js';

/** @deprecated use resolveGeocodingApiKey */
export const geocodingApiKey = resolveGeocodingApiKey;

/** @deprecated use resolveRoutingAccessToken */
export const routingAccessToken = resolveRoutingAccessToken;

/** @deprecated use geocodingApiKey */
export const maptilerApiKey = geocodingApiKey;

/** @deprecated use routingAccessToken */
export const mapboxAccessToken = routingAccessToken;

export { foursquarePlacesApiKey as foursquareApiKey } from '../../api/providers/foursquare-places.js';

export async function fetchGeocode(query: string): Promise<FeatureCollection> {
  const { ensureGeocodingRouterReady } = await import(
    '../../api/providers/setup-capability-routers.js'
  );
  const { getProviderForCapability } = await import('../../api/providers/registry.js');

  await ensureGeocodingRouterReady();
  const provider = getProviderForCapability('geocoding');
  if (!provider?.geocode) {
    throw new Error('Geocoding is not configured. Set GEOKIT_MAP_API_KEY or a routing token.');
  }

  return provider.geocode({ query: query.trim(), limit: 1 });
}

export async function fetchReverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult | null> {
  const { ensureGeocodingRouterReady } = await import(
    '../../api/providers/setup-capability-routers.js'
  );
  const { getProviderForCapability } = await import('../../api/providers/registry.js');

  await ensureGeocodingRouterReady();
  const provider = getProviderForCapability('geocoding');
  if (!provider?.reverseGeocode) {
    throw new Error(
      'Reverse geocoding is not configured. Set GEOKIT_MAP_API_KEY or a routing token.'
    );
  }

  return (await provider.reverseGeocode({ lat, lng, limit: 1 })) as ReverseGeocodeResult | null;
}

export async function fetchDirections(args: {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  mode?: 'driving' | 'walking' | 'cycling';
}): Promise<{ distanceMeters: number; durationSeconds: number } | null> {
  const token = resolveRoutingAccessToken();
  if (!token) return null;

  const modeMap = {
    driving: 'driving-traffic',
    walking: 'walking',
    cycling: 'cycling',
  } as const;
  const profile = modeMap[args.mode ?? 'driving'];
  const coordinates = `${args.fromLng},${args.fromLat};${args.toLng},${args.toLat}`;
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}`);
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'false');
  url.searchParams.set('access_token', token);

  const response = await fetch(url.toString());
  if (!response.ok) return null;

  const data = (await response.json()) as {
    routes?: Array<{ distance?: number; duration?: number }>;
  };
  const route = data.routes?.[0];
  if (!route?.distance || !route.duration) return null;
  return { distanceMeters: route.distance, durationSeconds: route.duration };
}

export async function fetchIsochrone(args: {
  lat: number;
  lng: number;
  minutes: number;
  mode: 'driving' | 'walking' | 'cycling' | 'driving-traffic';
}): Promise<FeatureCollection> {
  const { ensureIsochroneRouterReady } = await import(
    '../../api/providers/setup-capability-routers.js'
  );
  const { getProviderForCapability } = await import('../../api/providers/registry.js');

  await ensureIsochroneRouterReady();
  const provider = getProviderForCapability('isochrone');
  if (!provider?.fetchIsochrone) {
    throw new Error(
      'Drive-time areas need a routing API token (GEOKIT_ROUTING_TOKEN or ROUTING_TOKEN).'
    );
  }

  return provider.fetchIsochrone({
    lat: args.lat,
    lng: args.lng,
    minutes: [args.minutes],
    mode: args.mode,
  });
}

export async function fetchNearbyPlaces(args: {
  lat: number;
  lng: number;
  query: string;
  radiusMeters: number;
  limit: number;
}): Promise<PlaceSearchResult[]> {
  const { ensurePlaceSearchRouterReady } = await import(
    '../../api/providers/setup-capability-routers.js'
  );
  const { getProviderForCapability } = await import('../../api/providers/registry.js');

  await ensurePlaceSearchRouterReady();
  const provider = getProviderForCapability('placeSearch');
  if (!provider?.placeSearch) {
    throw new Error(
      'Place search is not configured. Set FOURSQUARE_SERVICE_API_KEY or GOOGLE_PLACES_API_KEY for nearby.'
    );
  }

  return (await provider.placeSearch({
    query: args.query,
    ll: [args.lng, args.lat],
    radius: args.radiusMeters,
    limit: Math.min(args.limit, 20),
    sort: 'DISTANCE',
  })) as PlaceSearchResult[];
}
