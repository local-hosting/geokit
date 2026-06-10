import type { FeatureCollection } from 'geojson';
import type { PlaceSearchResult, ReverseGeocodeResult } from '../../types/mcp-business-api.js';

function envTrim(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value || undefined;
}

export function geocodingApiKey(): string | undefined {
  return (
    envTrim('GEOKIT_MAP_API_KEY') ??
    envTrim('MAP_API_KEY') ??
    envTrim('MAPTILER_KEY') ??
    envTrim('GEOKIT_MAPTILER_KEY')
  );
}

export function routingAccessToken(): string | undefined {
  return (
    envTrim('GEOKIT_ROUTING_TOKEN') ??
    envTrim('ROUTING_TOKEN') ??
    envTrim('MAPBOX_TOKEN') ??
    envTrim('MAPBOX_ACCESS_TOKEN') ??
    envTrim('GEOKIT_MAPBOX_KEY')
  );
}

/** @deprecated use geocodingApiKey */
export const maptilerApiKey = geocodingApiKey;

/** @deprecated use routingAccessToken */
export const mapboxAccessToken = routingAccessToken;

export function foursquareApiKey(): string | undefined {
  return (
    envTrim('FOURSQUARE_API_KEY') ?? envTrim('FSQ_API_KEY') ?? envTrim('GEOKIT_FOURSQUARE_KEY')
  );
}

function requireKey(key: string | undefined, message: string): string {
  if (!key) throw new Error(message);
  return key;
}

export async function fetchGeocode(query: string): Promise<FeatureCollection> {
  const apiKey = requireKey(
    geocodingApiKey(),
    'Geocoding is not configured. Set GEOKIT_MAP_API_KEY.'
  );

  const encodedQuery = encodeURIComponent(query.trim());
  const url = new URL(`https://api.maptiler.com/geocoding/${encodedQuery}.json`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('limit', '1');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as FeatureCollection;
}

export async function fetchReverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult | null> {
  const apiKey = requireKey(
    geocodingApiKey(),
    'Reverse geocoding is not configured. Set GEOKIT_MAP_API_KEY.'
  );

  const url = new URL(`https://api.maptiler.com/geocoding/${lng},${lat}.json`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('limit', '1');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Reverse geocoding failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as FeatureCollection;
  const feature = data.features?.[0] as
    | {
        place_name?: string;
        text?: string;
        context?: Array<{ id?: string; text?: string; short_code?: string }>;
        place_type?: string[];
      }
    | undefined;

  if (!feature) return null;

  const context = feature.context ?? [];
  const findContext = (prefix: string): string | undefined => {
    if (feature.place_type?.includes(prefix)) return feature.text;
    return context.find((c) => c.id?.startsWith(`${prefix}.`))?.text;
  };

  return {
    address: feature.place_name,
    streetAddress: findContext('street') || findContext('address'),
    city: findContext('municipality') || findContext('place') || findContext('locality'),
    state: findContext('region'),
    postcode: findContext('postal_code'),
    country: findContext('country'),
    countryCode: context.find((c) => c.id?.startsWith('country.'))?.short_code?.toUpperCase(),
    neighborhood: findContext('neighbourhood') || findContext('neighborhood'),
    coordinates: [lng, lat],
    raw: feature,
  };
}

export async function fetchDirections(args: {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  mode?: 'driving' | 'walking' | 'cycling';
}): Promise<{ distanceMeters: number; durationSeconds: number } | null> {
  const token = routingAccessToken();
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
  const token = requireKey(
    routingAccessToken(),
    'Drive-time areas need a routing API token (GEOKIT_ROUTING_TOKEN or ROUTING_TOKEN).'
  );

  const modeMap: Record<string, string> = {
    driving: 'driving',
    walking: 'walking',
    cycling: 'cycling',
    'driving-traffic': 'driving-traffic',
  };
  const profile = modeMap[args.mode] ?? 'driving';

  const url = new URL(
    `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${args.lng},${args.lat}`
  );
  url.searchParams.set('contours_minutes', String(args.minutes));
  url.searchParams.set('polygons', 'true');
  url.searchParams.set('denoise', '1');
  url.searchParams.set('access_token', token);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Isochrone request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as FeatureCollection;
}

function formatFoursquareAddress(location: {
  address?: string;
  locality?: string;
  region?: string;
  postcode?: string;
}): string | undefined {
  const parts = [location.address, location.locality, location.region, location.postcode].filter(
    Boolean
  );
  return parts.length > 0 ? parts.join(', ') : undefined;
}

export async function fetchNearbyPlaces(args: {
  lat: number;
  lng: number;
  query: string;
  radiusMeters: number;
  limit: number;
}): Promise<PlaceSearchResult[]> {
  const apiKey = requireKey(
    foursquareApiKey(),
    'Place search is not configured. Set FOURSQUARE_API_KEY for nearby.'
  );

  const url = new URL('https://api.foursquare.com/v3/places/search');
  url.searchParams.set('query', args.query);
  url.searchParams.set('ll', `${args.lat},${args.lng}`);
  url.searchParams.set('radius', String(Math.round(args.radiusMeters)));
  url.searchParams.set('limit', String(Math.min(args.limit, 20)));
  url.searchParams.set('sort', 'DISTANCE');
  url.searchParams.set('fields', 'fsq_id,name,geocodes,location,categories,distance,rating');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: apiKey,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Place search failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    results?: Array<{
      fsq_id: string;
      name: string;
      geocodes?: { main?: { latitude: number; longitude: number } };
      location?: { address?: string; locality?: string; region?: string; postcode?: string };
      categories?: Array<{ name: string }>;
      distance?: number;
      rating?: number;
    }>;
  };

  return (data.results ?? []).map((place) => {
    const main = place.geocodes?.main;
    return {
      id: place.fsq_id,
      name: place.name,
      address: place.location ? formatFoursquareAddress(place.location) : undefined,
      location: main ? [main.longitude, main.latitude] : [0, 0],
      categories: place.categories?.map((c) => c.name),
      distance: place.distance,
      rating: place.rating,
    };
  });
}
