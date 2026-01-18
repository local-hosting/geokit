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
  let weightedHouseholdSize = 0;
  let weightedOwnerPct = 0;
  let weightedRenterPct = 0;
  let totalPopWithIncome = 0;
  let totalPopWithAge = 0;
  let totalPopWithHomeValue = 0;
  let totalPopWithRent = 0;
  let totalPopWithHouseholdSize = 0;
  let totalPopWithOwnerPct = 0;
  let totalPopWithRenterPct = 0;

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
    if (result.averageHouseholdSize !== undefined) {
      weightedHouseholdSize += result.averageHouseholdSize * pop;
      totalPopWithHouseholdSize += pop;
    }
    if (result.ownerOccupiedPct !== undefined) {
      weightedOwnerPct += result.ownerOccupiedPct * pop;
      totalPopWithOwnerPct += pop;
    }
    if (result.renterOccupiedPct !== undefined) {
      weightedRenterPct += result.renterOccupiedPct * pop;
      totalPopWithRenterPct += pop;
    }
  }

  // Find top two generations by weighted voting
  const generationVotes: Record<string, number> = {};
  for (const result of validResults) {
    if (result.topGeneration && result.topGenerationPct) {
      const pop = result.totalPopulation || 0;
      const weight = pop * (result.topGenerationPct / 100);
      generationVotes[result.topGeneration] = (generationVotes[result.topGeneration] || 0) + weight;
    }
    if (result.secondGeneration && result.secondGenerationPct) {
      const pop = result.totalPopulation || 0;
      const weight = pop * (result.secondGenerationPct / 100);
      generationVotes[result.secondGeneration] =
        (generationVotes[result.secondGeneration] || 0) + weight;
    }
  }

  let topGeneration: string | undefined;
  let topGenerationPct: number | undefined;
  let secondGeneration: string | undefined;
  let secondGenerationPct: number | undefined;

  const generationEntries = Object.entries(generationVotes).sort((a, b) => b[1] - a[1]);
  if (generationEntries.length > 0) {
    const [topGen, topWeight] = generationEntries[0];
    topGeneration = topGen;
    topGenerationPct = totalPop > 0 ? Math.round((topWeight / totalPop) * 100) : undefined;
  }
  if (generationEntries.length > 1) {
    const [secondGen, secondWeight] = generationEntries[1];
    secondGeneration = secondGen;
    secondGenerationPct = totalPop > 0 ? Math.round((secondWeight / totalPop) * 100) : undefined;
  }

  // Find top two languages by weighted voting
  const languageVotes: Record<string, number> = {};
  for (const result of validResults) {
    if (result.topLanguage && result.topLanguagePct) {
      const pop = result.totalPopulation || 0;
      const weight = pop * (result.topLanguagePct / 100);
      languageVotes[result.topLanguage] = (languageVotes[result.topLanguage] || 0) + weight;
    }
    if (result.secondLanguage && result.secondLanguagePct) {
      const pop = result.totalPopulation || 0;
      const weight = pop * (result.secondLanguagePct / 100);
      languageVotes[result.secondLanguage] = (languageVotes[result.secondLanguage] || 0) + weight;
    }
  }

  let topLanguage: string | undefined;
  let topLanguagePct: number | undefined;
  let secondLanguage: string | undefined;
  let secondLanguagePct: number | undefined;

  const languageEntries = Object.entries(languageVotes).sort((a, b) => b[1] - a[1]);
  if (languageEntries.length > 0) {
    const [topLang, topWeight] = languageEntries[0];
    topLanguage = topLang;
    topLanguagePct = totalPop > 0 ? Math.round((topWeight / totalPop) * 100) : undefined;
  }
  if (languageEntries.length > 1) {
    const [secondLang, secondWeight] = languageEntries[1];
    secondLanguage = secondLang;
    secondLanguagePct = totalPop > 0 ? Math.round((secondWeight / totalPop) * 100) : undefined;
  }

  return {
    totalPopulation: totalPop,
    medianHouseholdIncome:
      totalPopWithIncome > 0 ? Math.round(weightedIncome / totalPopWithIncome) : undefined,
    medianAge: totalPopWithAge > 0 ? Math.round(weightedAge / totalPopWithAge) : undefined,
    medianHomeValue:
      totalPopWithHomeValue > 0 ? Math.round(weightedHomeValue / totalPopWithHomeValue) : undefined,
    medianRent: totalPopWithRent > 0 ? Math.round(weightedRent / totalPopWithRent) : undefined,
    averageHouseholdSize:
      totalPopWithHouseholdSize > 0
        ? Math.round((weightedHouseholdSize / totalPopWithHouseholdSize) * 10) / 10
        : undefined,
    ownerOccupiedPct:
      totalPopWithOwnerPct > 0 ? Math.round(weightedOwnerPct / totalPopWithOwnerPct) : undefined,
    renterOccupiedPct:
      totalPopWithRenterPct > 0 ? Math.round(weightedRenterPct / totalPopWithRenterPct) : undefined,
    topGeneration,
    topGenerationPct,
    secondGeneration,
    secondGenerationPct,
    topLanguage,
    topLanguagePct,
    secondLanguage,
    secondLanguagePct,
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
  const householdSizes = results
    .map((r) => r.averageHouseholdSize)
    .filter((v): v is number => v !== undefined);
  const ownerPcts = results
    .map((r) => r.ownerOccupiedPct)
    .filter((v): v is number => v !== undefined);
  const renterPcts = results
    .map((r) => r.renterOccupiedPct)
    .filter((v): v is number => v !== undefined);

  // Find top two generations by counting occurrences
  const generationCounts: Record<string, number> = {};
  for (const result of results) {
    if (result.topGeneration) {
      generationCounts[result.topGeneration] = (generationCounts[result.topGeneration] || 0) + 1;
    }
    if (result.secondGeneration) {
      generationCounts[result.secondGeneration] =
        (generationCounts[result.secondGeneration] || 0) + 0.5; // Weight second less
    }
  }

  let topGeneration: string | undefined;
  let topGenerationPct: number | undefined;
  let secondGeneration: string | undefined;
  let secondGenerationPct: number | undefined;

  const genEntries = Object.entries(generationCounts).sort((a, b) => b[1] - a[1]);
  if (genEntries.length > 0) {
    const [topGen] = genEntries[0];
    topGeneration = topGen;
    const topGenPcts = results
      .filter((r) => r.topGeneration === topGen)
      .map((r) => r.topGenerationPct)
      .filter((v): v is number => v !== undefined);
    topGenerationPct =
      topGenPcts.length > 0
        ? Math.round(topGenPcts.reduce((a, b) => a + b, 0) / topGenPcts.length)
        : undefined;
  }
  if (genEntries.length > 1) {
    const [secondGen] = genEntries[1];
    secondGeneration = secondGen;
    const secondGenPcts = results
      .filter((r) => r.topGeneration === secondGen || r.secondGeneration === secondGen)
      .map((r) => (r.topGeneration === secondGen ? r.topGenerationPct : r.secondGenerationPct))
      .filter((v): v is number => v !== undefined);
    secondGenerationPct =
      secondGenPcts.length > 0
        ? Math.round(secondGenPcts.reduce((a, b) => a + b, 0) / secondGenPcts.length)
        : undefined;
  }

  // Find top two languages by counting occurrences
  const languageCounts: Record<string, number> = {};
  for (const result of results) {
    if (result.topLanguage) {
      languageCounts[result.topLanguage] = (languageCounts[result.topLanguage] || 0) + 1;
    }
    if (result.secondLanguage) {
      languageCounts[result.secondLanguage] = (languageCounts[result.secondLanguage] || 0) + 0.5;
    }
  }

  let topLanguage: string | undefined;
  let topLanguagePct: number | undefined;
  let secondLanguage: string | undefined;
  let secondLanguagePct: number | undefined;

  const langEntries = Object.entries(languageCounts).sort((a, b) => b[1] - a[1]);
  if (langEntries.length > 0) {
    const [topLang] = langEntries[0];
    topLanguage = topLang;
    const topLangPcts = results
      .filter((r) => r.topLanguage === topLang)
      .map((r) => r.topLanguagePct)
      .filter((v): v is number => v !== undefined);
    topLanguagePct =
      topLangPcts.length > 0
        ? Math.round(topLangPcts.reduce((a, b) => a + b, 0) / topLangPcts.length)
        : undefined;
  }
  if (langEntries.length > 1) {
    const [secondLang] = langEntries[1];
    secondLanguage = secondLang;
    const secondLangPcts = results
      .filter((r) => r.topLanguage === secondLang || r.secondLanguage === secondLang)
      .map((r) => (r.topLanguage === secondLang ? r.topLanguagePct : r.secondLanguagePct))
      .filter((v): v is number => v !== undefined);
    secondLanguagePct =
      secondLangPcts.length > 0
        ? Math.round(secondLangPcts.reduce((a, b) => a + b, 0) / secondLangPcts.length)
        : undefined;
  }

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
    averageHouseholdSize:
      householdSizes.length > 0
        ? Math.round((householdSizes.reduce((a, b) => a + b, 0) / householdSizes.length) * 10) / 10
        : undefined,
    ownerOccupiedPct:
      ownerPcts.length > 0
        ? Math.round(ownerPcts.reduce((a, b) => a + b, 0) / ownerPcts.length)
        : undefined,
    renterOccupiedPct:
      renterPcts.length > 0
        ? Math.round(renterPcts.reduce((a, b) => a + b, 0) / renterPcts.length)
        : undefined,
    topGeneration,
    topGenerationPct,
    secondGeneration,
    secondGenerationPct,
    topLanguage,
    topLanguagePct,
    secondLanguage,
    secondLanguagePct,
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
