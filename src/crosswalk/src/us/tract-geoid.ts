/** Parse county / state FIPS from an 11-digit census tract GEOID. */

import { stateAbbrForTractFips } from './state-fips.js';

export function normalizeTractGeoid(geoid: string): string {
  const trimmed = geoid.trim();
  if (!trimmed || trimmed.length < 10) {
    throw new Error(`tract GEOID must be at least 10 digits, got "${geoid}"`);
  }
  return trimmed.padStart(11, '0').slice(0, 11);
}

export function tractStateFips(geoid: string): string {
  return normalizeTractGeoid(geoid).slice(0, 2);
}

export function tractCountyFips(geoid: string): string {
  return normalizeTractGeoid(geoid).slice(0, 5);
}

/** USPS state abbreviation (lowercase) from a census tract GEOID. */
export function stateAbbrForTract(geoid: string): string | undefined {
  return stateAbbrForTractFips(tractStateFips(geoid));
}
