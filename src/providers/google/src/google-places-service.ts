/**
 * Google Places service — place search via Google Places API.
 */

import { CachedService } from '@doppler-group/geokit/service';
import { type ServiceConfig, type ServiceCapability, type PlaceSearchOptions, type PlaceSearchResult } from '@doppler-group/geokit/service/types';
import { fetchWithRetry } from '@doppler-group/geokit/service';
const SERVICE_LABEL = 'Google Places';

export class GooglePlacesService extends CachedService<PlaceSearchResult[]> {
  constructor() {
    super({ cacheName: 'GooglePlacesCache', maxConcurrent: 10 });
  }

  getName(): string {
    return 'google-places';
  }

  async initialize(config: ServiceConfig): Promise<void> {
    this.initCredentials(config, 'gk-google-places');
  }

  getCapabilities(): ServiceCapability[] {
    return ['placeSearch'];
  }

  async placeSearch(options: PlaceSearchOptions): Promise<PlaceSearchResult[]> {
    this.requireApiKey(`${SERVICE_LABEL} service`);
    return this.cachedPlaceSearch(
      options,
      'gplaces',
      [
        ...(options.sort ? [`sort:${options.sort}`] : []),
        ...(options.openNow !== undefined ? [`open:${options.openNow}`] : []),
      ],
      () => this.placeSearchInternal(options)
    );
  }

  private async placeSearchInternal(options: PlaceSearchOptions): Promise<PlaceSearchResult[]> {
    const { query, ll, radius, limit = 10 } = options;
    const categories = options.categories;
    let url: string;
    let params: URLSearchParams;

    if (query) {
      url = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
      params = new URLSearchParams({
        input: query,
        inputtype: 'textquery',
        fields: 'place_id,name,geometry,formatted_address,rating,user_ratings_total,price_level',
        key: this.apiKey!,
      });
      if (ll) {
        params.set('locationbias', `point:${ll[1]},${ll[0]}`);
      }
    } else if (ll) {
      url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
      params = new URLSearchParams({
        location: `${ll[1]},${ll[0]}`,
        radius: radius ? radius.toString() : '5000',
        key: this.apiKey!,
      });
      if (limit) {
        params.set('maxresults', Math.min(limit, 20).toString());
      }
      if (categories?.length) {
        params.set('type', categories[0]);
      }
    } else {
      throw new Error('Google Places service: Either query or location (ll) is required');
    }

    const response = await fetchWithRetry(() => fetch(`${url}?${params}`), SERVICE_LABEL);
    const data = await response.json();

    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(
        `Google Places API error: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`
      );
    }

    return (data.candidates || data.results || [])
      .map((place: Record<string, unknown>) => this.transformResult(place));
  }

  private transformResult(place: Record<string, unknown>): PlaceSearchResult {
    const geometry = place.geometry as { location?: { lng: number; lat: number } } | undefined;
    const location = geometry?.location;
    const types = place.types as string[] | undefined;

    return {
      id: String(place.place_id),
      name: String(place.name),
      address: (place.formatted_address || place.vicinity) as string | undefined,
      location: location ? [location.lng, location.lat] : [0, 0],
      categories: types ? types.filter((t) => !t.startsWith('point_of_interest')) : [],
      distance: place.distance as number | undefined,
      rating: place.rating as number | undefined,
      priceLevel: place.price_level as number | undefined,
      hours: place.opening_hours
        ? {
            openNow: (place.opening_hours as { open_now?: boolean }).open_now,
            display: (
              (place.opening_hours as { weekday_text?: string[] }).weekday_text ?? []
            ).join(', '),
          }
        : undefined,
      contact: {
        phone: (place.formatted_phone_number || place.international_phone_number) as
          | string
          | undefined,
        website: place.website as string | undefined,
      },
      raw: place,
    };
  }
}
