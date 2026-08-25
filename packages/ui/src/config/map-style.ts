/**
 * Mapbox basemap style resolution — env-driven with stock Mapbox fallback.
 */
export const DEFAULT_MAPBOX_STYLE_URI = 'mapbox://styles/mapbox/streets-v12';

/** Mapbox Static Images API style path (`owner/styleId`). */
export const DEFAULT_MAPBOX_STATIC_STYLE = 'mapbox/streets-v12';

/** Convert `mapbox://styles/owner/id` to Static API `owner/id`. */
export function mapboxStyleUriToStaticStyle(styleUri: string): string {
  const prefix = 'mapbox://styles/';
  if (styleUri.startsWith(prefix)) {
    return styleUri.slice(prefix.length);
  }
  return styleUri;
}

export function resolveMapboxStyleUri(
  env: { GEOKIT_MAP_STYLE_URL?: string; MAP_STYLE_URL?: string } = process.env as {
    GEOKIT_MAP_STYLE_URL?: string;
    MAP_STYLE_URL?: string;
  }
): string {
  const explicit = env.GEOKIT_MAP_STYLE_URL?.trim() || env.MAP_STYLE_URL?.trim();
  return explicit || DEFAULT_MAPBOX_STYLE_URI;
}

export function resolveMapboxStaticStyle(
  env: { GEOKIT_MAP_STYLE_URL?: string; MAP_STYLE_URL?: string } = process.env as {
    GEOKIT_MAP_STYLE_URL?: string;
    MAP_STYLE_URL?: string;
  }
): string {
  return mapboxStyleUriToStaticStyle(resolveMapboxStyleUri(env));
}
