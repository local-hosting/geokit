/**
 * Business-focused geospatial utilities
 * Common patterns for retail, logistics, and service businesses
 */

import { haversineMeters } from '../distance';
import { pointInPolygon } from '../containment';
import { getBounds } from '../bounds';
import type { Coordinate, Polygon } from '../../types';

/**
 * Store locator utilities
 */
export interface Store {
  id: string;
  name: string;
  location: Coordinate;
  address?: string;
  hours?: string;
  phone?: string;
}

export interface StoreSearchOptions {
  maxDistance?: number; // meters
  limit?: number;
  openNow?: boolean;
}

/**
 * Find nearest stores to a location
 */
export function findNearestStores(
  userLocation: Coordinate,
  stores: Store[],
  options: StoreSearchOptions = {}
): Array<Store & { distance: number }> {
  const { maxDistance = 50000, limit = 10 } = options;
  
  return stores
    .map(store => ({
      ...store,
      distance: haversineMeters(userLocation)(store.location)
    }))
    .filter(store => store.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

/**
 * Delivery zone utilities
 */
export interface DeliveryZone {
  id: string;
  name: string;
  polygon: Polygon;
  fee?: number;
  minOrder?: number;
  estimatedTime?: number; // minutes
}

/**
 * Check if location is in delivery zone
 */
export function isInDeliveryZone(
  location: Coordinate,
  zones: DeliveryZone[]
): DeliveryZone | null {
  for (const zone of zones) {
    if (pointInPolygon(location)(zone.polygon)) {
      return zone;
    }
  }
  return null;
}

/**
 * Service area utilities for field services
 */
export interface ServiceArea {
  id: string;
  name: string;
  polygon: Polygon;
  technicians?: number;
  avgResponseTime?: number; // minutes
}

/**
 * Territory management - assign locations to service areas
 */
export function assignToServiceArea(
  locations: Coordinate[],
  serviceAreas: ServiceArea[]
): Array<{ location: Coordinate; area: ServiceArea | null }> {
  return locations.map(location => ({
    location,
    area: serviceAreas.find(area => 
      pointInPolygon(location)(area.polygon)
    ) || null
  }));
}

/**
 * Market analysis utilities
 */
export interface MarketData {
  location: Coordinate;
  population?: number;
  medianIncome?: number;
  competitors?: number;
  footTraffic?: number;
}

/**
 * Calculate market opportunity score
 */
export function calculateMarketScore(
  data: MarketData,
  weights: {
    population?: number;
    income?: number;
    competition?: number;
    traffic?: number;
  } = {}
): number {
  const {
    population = 0.3,
    income = 0.2,
    competition = -0.3, // negative because more competition is worse
    traffic = 0.2
  } = weights;

  let score = 0;
  let totalWeight = 0;

  if (data.population) {
    score += (data.population / 100000) * population;
    totalWeight += Math.abs(population);
  }

  if (data.medianIncome) {
    score += (data.medianIncome / 75000) * income;
    totalWeight += Math.abs(income);
  }

  if (data.competitors !== undefined) {
    score += (1 / (data.competitors + 1)) * competition;
    totalWeight += Math.abs(competition);
  }

  if (data.footTraffic) {
    score += (data.footTraffic / 1000) * traffic;
    totalWeight += Math.abs(traffic);
  }

  return totalWeight > 0 ? Math.max(0, score / totalWeight) : 0;
}