/** Static map / snapshot provider ids (web). Protomaps has no static image API. */
export type MapStaticProviderId = 'maptiler' | 'mapbox';

/** Interactive map backend ids. */
export type MapUiProviderId = MapStaticProviderId | 'protomaps';
