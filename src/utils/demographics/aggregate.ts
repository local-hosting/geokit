/**
 * Demographic Data Aggregation Utilities
 *
 * Functions to aggregate demographic data across multiple geographic areas
 * Useful for querying demographics for polygons/bounds (map views)
 */

import type { DemographicsResult } from '../../api/providers/types';
import type { Polygon, MultiPolygon, Position, Geometry } from 'geojson';
import { pointInGeometry } from '../containment/point-in-geometry';
import { getBounds } from '../bounds';

/**
 * Aggregate multiple demographic results into a single result
 * Weighted by population when available
 */
export function aggregateDemographics(results: DemographicsResult[]): DemographicsResult | null {
  if (results.length === 0) return null;
  if (results.length === 1) return results[0];

  // Filter out null/undefined results
  const validResults = results.filter(
    (r): r is DemographicsResult => r !== null && r !== undefined
  );
  if (validResults.length === 0) return null;

  // Calculate total population for weighting
  const totalPop = validResults.reduce((sum, r) => sum + (r.totalPopulation || 0), 0);
  if (totalPop === 0) {
    // If no population data, use simple average
    return aggregateByAverage(validResults);
  }

  // Weighted aggregation by population
  let weightedIncome = 0;
  let weightedAge = 0;
  let weightedHomeValue = 0;
  let weightedRent = 0;
  let totalPopWithIncome = 0;
  let totalPopWithAge = 0;
  let totalPopWithHomeValue = 0;
  let totalPopWithRent = 0;

  for (const result of validResults) {
    const pop = result.totalPopulation || 0;

    if (result.medianHouseholdIncome !== undefined) {
      weightedIncome += result.medianHouseholdIncome * pop;
      totalPopWithIncome += pop;
    }
    if (result.medianAge !== undefined) {
      weightedAge += result.medianAge * pop;
      totalPopWithAge += pop;
    }
    if (result.medianHomeValue !== undefined) {
      weightedHomeValue += result.medianHomeValue * pop;
      totalPopWithHomeValue += pop;
    }
    if (result.medianRent !== undefined) {
      weightedRent += result.medianRent * pop;
      totalPopWithRent += pop;
    }
  }

  return {
    totalPopulation: totalPop,
    medianHouseholdIncome:
      totalPopWithIncome > 0 ? Math.round(weightedIncome / totalPopWithIncome) : undefined,
    medianAge: totalPopWithAge > 0 ? Math.round(weightedAge / totalPopWithAge) : undefined,
    medianHomeValue:
      totalPopWithHomeValue > 0 ? Math.round(weightedHomeValue / totalPopWithHomeValue) : undefined,
    medianRent: totalPopWithRent > 0 ? Math.round(weightedRent / totalPopWithRent) : undefined,
    dataSource: validResults[0].dataSource,
    year: validResults[0].year,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Aggregate by simple average (when population data unavailable)
 */
function aggregateByAverage(results: DemographicsResult[]): DemographicsResult {
  const incomes = results
    .map((r) => r.medianHouseholdIncome)
    .filter((v): v is number => v !== undefined);
  const ages = results.map((r) => r.medianAge).filter((v): v is number => v !== undefined);
  const homeValues = results
    .map((r) => r.medianHomeValue)
    .filter((v): v is number => v !== undefined);
  const rents = results.map((r) => r.medianRent).filter((v): v is number => v !== undefined);

  return {
    totalPopulation: results.reduce((sum, r) => sum + (r.totalPopulation || 0), 0),
    medianHouseholdIncome:
      incomes.length > 0
        ? Math.round(incomes.reduce((a, b) => a + b, 0) / incomes.length)
        : undefined,
    medianAge:
      ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : undefined,
    medianHomeValue:
      homeValues.length > 0
        ? Math.round(homeValues.reduce((a, b) => a + b, 0) / homeValues.length)
        : undefined,
    medianRent:
      rents.length > 0 ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length) : undefined,
    dataSource: results[0]?.dataSource,
    year: results[0]?.year,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Filter demographic results by geographic bounds
 * Returns demographics for areas that intersect with the bounds
 */
export function filterDemographicsByBounds(
  demographics: Array<{ location: Position; data: DemographicsResult }>,
  bounds: [number, number, number, number] // [minLng, minLat, maxLng, maxLat]
): DemographicsResult[] {
  const [minLng, minLat, maxLng, maxLat] = bounds;

  return demographics
    .filter(({ location }) => {
      const [lng, lat] = location;
      return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
    })
    .map(({ data }) => data);
}

/**
 * Filter demographic results by polygon
 * Returns demographics for areas that intersect with the polygon
 */
export function filterDemographicsByPolygon(
  demographics: Array<{ location: Position; data: DemographicsResult }>,
  polygon: Polygon | MultiPolygon
): DemographicsResult[] {
  return demographics
    .filter(({ location }) => {
      const [lng, lat] = location;
      return pointInGeometry([lat, lng], polygon);
    })
    .map(({ data }) => data);
}

/**
 * Get bounds from a polygon (convenience wrapper)
 * Uses geokit's existing getBounds utility
 */
export function getPolygonBounds(
  polygon: Polygon | MultiPolygon
): [number, number, number, number] | null {
  // Convert polygon to geometry array for getBounds
  const bounds = getBounds([polygon as Geometry]);
  if (!bounds) return null;
  // getBounds returns [minLon, minLat, maxLon, maxLat] (GeoJSON format)
  // Return as [minLng, minLat, maxLng, maxLat] for consistency
  return [bounds[0], bounds[1], bounds[2], bounds[3]];
}
