/**
 * First-paint map style for gk-map createMap.
 * Host `style-url` (e.g. Corio Mapbox URI) wins over theme stock names so providers
 * do not load the wrong basemap and hang the style-load poll.
 */
export function resolveInitialMapStyle(options: {
  styleUrl?: string | null;
  themeMapStyle?: string | null;
  mapStyleAttr?: string | null;
  systemMapStyle?: string | null;
}): string {
  const styleUrl = options.styleUrl?.trim();
  if (styleUrl) return styleUrl;

  const mapStyleAttr = options.mapStyleAttr?.trim();
  if (mapStyleAttr) return mapStyleAttr;

  const themeMapStyle = options.themeMapStyle?.trim();
  if (themeMapStyle) return themeMapStyle;

  return options.systemMapStyle?.trim() || '';
}
