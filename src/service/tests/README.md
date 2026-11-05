# API Provider Tests

This directory contains tests for wired API providers in geokit (routing, geocoding, place search).

## Test Files

- `tests/mocks/mock-api-provider.ts` - Shared MockAPIProvider for registry tests
- `registry.test.ts` - Provider registry functionality tests
- `foursquare-provider.test.ts` - Foursquare API provider tests
- `mapbox-provider.test.ts` - Mapbox API provider tests
- `maptiler-provider.test.ts` - MapTiler API provider tests
- `google-places-provider.test.ts` - Google Places API provider tests

## Provider Response Types

### MapboxService

- **fetchIsochrone()**: `Promise<FeatureCollection>` - Always returns FeatureCollection (throws on error)
- **directions()**: `Promise<FeatureCollection>` - Always returns FeatureCollection (throws on error)
- **geocode()**: `Promise<FeatureCollection>` - Always returns FeatureCollection (throws on error)

### MapTilerService

- **geocode()**: `Promise<FeatureCollection>` - Always returns FeatureCollection (throws on error)

### FoursquareService

- **placeSearch()**: `Promise<PlaceSearchResult[]>` - Always returns array (empty array if no results, throws on error)

### GooglePlacesService

- **placeSearch()**: `Promise<PlaceSearchResult[]>` - Always returns array (empty array if no results, throws on error)

Ratings, reviews, weather, and behavioral enrichment are ingested in `packages/pipeline` and served from host catalogs — not live vendor calls from geokit.

## Response Guarantees

All providers return responses — they never return `undefined`.

- Data structures (FeatureCollection, PlaceSearchResult[]): always returned; empty arrays/collections when no results
- Errors: throw for API failures, invalid requests, or missing configuration

## Running Tests

```bash
yarn test tests/unit/api/
yarn test tests/unit/api/foursquare-provider.test.ts
```
