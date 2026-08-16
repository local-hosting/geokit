/**
 * Corio product Mapbox basemap — shared by geokit-swift (GeoKitDemoConstants), MCP, and web UI.
 */
export const CORIO_MAPBOX_STYLE_URI = 'mapbox://styles/corio/cm1gmmsh900xd01nw38jtafz7';

/** Mapbox Static Images API style path (`owner/styleId`). */
export const CORIO_MAPBOX_STATIC_STYLE = 'corio/cm1gmmsh900xd01nw38jtafz7';

/** Convert `mapbox://styles/owner/id` to Static API `owner/id`. */
export function mapboxStyleUriToStaticStyle(styleUri: string): string {
  const prefix = 'mapbox://styles/';
  if (styleUri.startsWith(prefix)) {
    return styleUri.slice(prefix.length);
  }
  return styleUri;
}

export function resolveDopplerMapboxStyleUri(
  env: { GEOKIT_MAP_STYLE_URL?: string; MAP_STYLE_URL?: string } = process.env as {
    GEOKIT_MAP_STYLE_URL?: string;
    MAP_STYLE_URL?: string;
  }
): string {
  const explicit = env.GEOKIT_MAP_STYLE_URL?.trim() || env.MAP_STYLE_URL?.trim();
  return explicit || CORIO_MAPBOX_STYLE_URI;
}

export function resolveDopplerMapboxStaticStyle(
  env: { GEOKIT_MAP_STYLE_URL?: string; MAP_STYLE_URL?: string } = process.env as {
    GEOKIT_MAP_STYLE_URL?: string;
    MAP_STYLE_URL?: string;
  }
): string {
  return mapboxStyleUriToStaticStyle(resolveDopplerMapboxStyleUri(env));
}
