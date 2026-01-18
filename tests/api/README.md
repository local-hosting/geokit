# API Provider Tests

This directory contains tests for all API providers in the geokit library.

## Test Files

- `test-utils.ts` - Shared test utilities (MockAPIProvider)
- `registry.test.ts` - Provider registry functionality tests
- `foursquare-provider.test.ts` - Foursquare API provider tests
- `mapbox-provider.test.ts` - Mapbox API provider tests
- `maptiler-provider.test.ts` - MapTiler API provider tests
- `google-places-provider.test.ts` - Google Places API provider tests
- `census-demographics-provider.test.ts` - Census Demographics API provider tests

## Provider Response Types

### MapboxAPIProvider

- **fetchIsochrone()**: `Promise<FeatureCollection>` - Always returns FeatureCollection (throws on error)
- **directions()**: `Promise<FeatureCollection>` - Always returns FeatureCollection (throws on error)
- **geocode()**: `Promise<FeatureCollection>` - Always returns FeatureCollection (throws on error)

### MapTilerAPIProvider

- **geocode()**: `Promise<FeatureCollection>` - Always returns FeatureCollection (throws on error)

### FoursquareAPIProvider

- **placeSearch()**: `Promise<PlaceSearchResult[]>` - Always returns array (empty array if no results, throws on error)
- **fetchBehavioral()**: `Promise<BehavioralResult | null>` - Returns null if place not found, throws on error

### GooglePlacesAPIProvider

- **placeSearch()**: `Promise<PlaceSearchResult[]>` - Always returns array (empty array if no results, throws on error)
- **fetchBehavioral()**: `Promise<BehavioralResult | null>` - Returns null if place not found, throws on error

### CensusDemographicsProvider

- **fetchDemographics()**: `Promise<DemographicsResult | null>` - Returns null if data unavailable or invalid input, throws on network error

## Response Guarantees

✅ **All providers return responses** - They never return `undefined`

**Response patterns:**

- **Data structures** (FeatureCollection, PlaceSearchResult[]): Always returned, empty arrays/collections if no results
- **Nullable results** (BehavioralResult | null, DemographicsResult | null): Can return `null` when data unavailable
- **Errors**: Throw exceptions for API failures, invalid requests, or missing configuration

**Empty results handling:**

- Place search methods return empty arrays `[]` when no places found
- Geocoding methods return FeatureCollection with empty features array
- Isochrone methods return FeatureCollection with empty features array
- Behavioral/demographics methods return `null` when data unavailable

## Running Tests

```bash
# Run all API provider tests
yarn test tests/api/

# Run specific provider tests
yarn test tests/api/foursquare-provider.test.ts
yarn test tests/api/mapbox-provider.test.ts
```
