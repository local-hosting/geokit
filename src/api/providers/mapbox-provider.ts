/**
 * Mapbox API Provider
 * 
 * Implements BaseAPIProvider for Mapbox services
 * Provides isochrone, directions, and matrix capabilities
 */

import {
  BaseAPIProvider,
  type MapProviderConfig,
  type APICapability,
  type IsochroneOptions,
  type DirectionsOptions,
} from './types';
import type { FeatureCollection } from 'geojson';

export class MapboxAPIProvider extends BaseAPIProvider {
  protected config: MapProviderConfig | null = null;
  private accessToken: string | null = null;

  getName(): string {
    return 'mapbox';
  }

  async initialize(config: MapProviderConfig): Promise<void> {
    this.config = config;

    if (config?.accessToken) {
      this.accessToken = config.accessToken;
    } else {
      console.warn(
        'Mapbox API Provider: No access token provided. API calls will not work.'
      );
    }
  }

  getCapabilities(): APICapability[] {
    return ['isochrone', 'directions', 'matrix'];
  }

  async fetchIsochrone(options: IsochroneOptions): Promise<FeatureCollection> {
    if (!this.accessToken) {
      throw new Error('Mapbox API Provider: No access token configured.');
    }

    const { lat, lng, minutes, mode, colors } = options;

    // Validate inputs
    if (!lat || !lng || !minutes || minutes.length === 0) {
      throw new Error('Mapbox API Provider: Invalid isochrone parameters');
    }

    // Map mode to Mapbox profile
    const modeMap: Record<string, string> = {
      driving: 'driving-traffic',
      walking: 'walking',
      cycling: 'cycling',
      'driving-traffic': 'driving-traffic',
    };
    const profile = modeMap[mode] || 'driving-traffic';

    try {
      // Build API URL
      const url = new URL(
        `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}`
      );
      url.searchParams.set('contours_minutes', minutes.join(','));
      url.searchParams.set('polygons', 'true');
      url.searchParams.set('denoise', '1'); // Max smoothing
      url.searchParams.set('access_token', this.accessToken);

      // Add midday departure time for traffic-aware modes
      if (profile === 'driving-traffic') {
        const today = new Date();
        const midday = `${today.getFullYear()}-${String(
          today.getMonth() + 1
        ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T12:00`;
        url.searchParams.set('depart_at', midday);
      }

      // Add custom colors if provided
      if (colors && colors.length > 0) {
        const mapboxColors = colors
          .slice(0, minutes.length)
          .map((c) => c.replace('#', ''));
        url.searchParams.set('contours_colors', mapboxColors.join(','));
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `Mapbox API error: ${response.status} ${response.statusText}${
            (error as any).message ? ` - ${(error as any).message}` : ''
          }`
        );
      }

      const data = await response.json();
      return data as FeatureCollection;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch isochrone: ${error.message}`);
      }
      throw new Error('Failed to fetch isochrone');
    }
  }

  async directions(options: DirectionsOptions): Promise<FeatureCollection> {
    if (!this.accessToken) {
      throw new Error('Mapbox API Provider: No access token configured.');
    }

    const { waypoints, mode = 'driving', alternatives = false } = options;

    if (!waypoints || waypoints.length < 2) {
      throw new Error(
        'Mapbox API Provider: At least 2 waypoints are required for directions'
      );
    }

    // Map mode to Mapbox profile
    const modeMap: Record<string, string> = {
      driving: 'driving-traffic',
      walking: 'walking',
      cycling: 'cycling',
    };
    const profile = modeMap[mode] || 'driving-traffic';

    try {
      // Build coordinates string
      const coordinates = waypoints.map((w) => `${w[0]},${w[1]}`).join(';');

      // Build API URL
      const url = new URL(
        `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}`
      );
      url.searchParams.set('geometries', 'geojson');
      url.searchParams.set('overview', 'full');
      url.searchParams.set('alternatives', alternatives.toString());
      url.searchParams.set('access_token', this.accessToken);

      const response = await fetch(url.toString());

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `Mapbox API error: ${response.status} ${response.statusText}${
            (error as any).message ? ` - ${(error as any).message}` : ''
          }`
        );
      }

      const data = await response.json();

      // Convert routes to GeoJSON FeatureCollection
      const features = (data as any).routes.map((route: any, index: number) => ({
        type: 'Feature',
        properties: {
          duration: route.duration,
          distance: route.distance,
          weight: route.weight,
          routeIndex: index,
        },
        geometry: route.geometry,
      }));

      return {
        type: 'FeatureCollection',
        features,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch directions: ${error.message}`);
      }
      throw new Error('Failed to fetch directions');
    }
  }
}

