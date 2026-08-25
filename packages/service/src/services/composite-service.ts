import type { FeatureCollection } from 'geojson';
import type { CompositeServiceOptions } from '../types/api-composite';
import {
  type ServiceCapability,
  type GeocodeOptions,
  type IsochroneOptions,
  type ServiceConfig,
  type PlaceSearchOptions,
  type PlaceSearchResult,
  type ReverseGeocodeOptions,
  type ReverseGeocodeResult,
} from './types.js';
import { Service } from './service.js';

function isUsableGeocodeResult(result: unknown): result is FeatureCollection {
  if (!result || typeof result !== 'object') {
    return false;
  }
  const features = (result as FeatureCollection).features;
  return Array.isArray(features) && features.length > 0;
}

function isUsableIsochroneResult(result: unknown): result is FeatureCollection {
  return isUsableGeocodeResult(result);
}

function isUsablePlaceSearchResult(result: unknown): result is PlaceSearchResult[] {
  return Array.isArray(result) && result.length > 0;
}

function lastErrorMessage(errors: Error[]): string {
  return errors.length > 0 ? errors[errors.length - 1]!.message : 'All services failed';
}

/**
 * Routes a capability to the first provider in a chain that succeeds.
 * Used for geocoding (MapTiler → Mapbox), place search (Foursquare → Google), etc.
 */
export class CompositeService extends Service {
  private readonly chains: CompositeServiceOptions['chains'];

  constructor(
    private readonly compositeName: string,
    chains: CompositeServiceOptions['chains']
  ) {
    super();
    this.chains = chains;
  }

  getName(): string {
    return this.compositeName;
  }

  async initialize(_config: ServiceConfig): Promise<void> {
    // Child providers are initialized by builtins bootstrap.
  }

  getCapabilities(): ServiceCapability[] {
    return Object.keys(this.chains) as ServiceCapability[];
  }

  private servicesFor(capability: ServiceCapability): Service[] {
    return this.chains[capability] ?? [];
  }

  async geocode(options: GeocodeOptions): Promise<FeatureCollection> {
    const errors: Error[] = [];

    for (const provider of this.servicesFor('geocoding')) {
      if (!provider.geocode) {
        continue;
      }

      try {
        const result = await provider.geocode(options);
        if (isUsableGeocodeResult(result)) {
          return result;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    throw new Error(`Geocoding failed: ${lastErrorMessage(errors)}`);
  }

  async reverseGeocode(options: ReverseGeocodeOptions): Promise<ReverseGeocodeResult | null> {
    const errors: Error[] = [];

    for (const provider of this.servicesFor('geocoding')) {
      if (!provider.reverseGeocode) {
        continue;
      }

      try {
        const result = await provider.reverseGeocode(options);
        if (result) {
          return result;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    if (errors.length > 0) {
      throw new Error(`Reverse geocoding failed: ${lastErrorMessage(errors)}`);
    }

    return null;
  }

  async placeSearch(options: PlaceSearchOptions): Promise<PlaceSearchResult[]> {
    const errors: Error[] = [];

    for (const provider of this.servicesFor('placeSearch')) {
      if (!provider.placeSearch) {
        continue;
      }

      try {
        const result = await provider.placeSearch(options);
        if (isUsablePlaceSearchResult(result)) {
          return result;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    if (errors.length > 0) {
      throw new Error(`Place search failed: ${lastErrorMessage(errors)}`);
    }

    return [];
  }

  async fetchIsochrone(options: IsochroneOptions): Promise<FeatureCollection> {
    const errors: Error[] = [];

    for (const provider of this.servicesFor('isochrone')) {
      if (!provider.fetchIsochrone) {
        continue;
      }

      try {
        const result = await provider.fetchIsochrone(options);
        if (isUsableIsochroneResult(result)) {
          return result;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    throw new Error(`Isochrone fetch failed: ${lastErrorMessage(errors)}`);
  }

  hasIsochroneCached(options: IsochroneOptions): boolean {
    for (const provider of this.servicesFor('isochrone')) {
      if (provider.hasIsochroneCached?.(options)) {
        return true;
      }
    }
    return false;
  }
}

export function createCompositeService(
  options: CompositeServiceOptions
): CompositeService {
  return new CompositeService(options.name, options.chains);
}
