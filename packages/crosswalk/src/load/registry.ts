import type { CrosswalkCountry, UsCrosswalkTables } from '../types.js';
import type { UsTableLookups } from '../us/tables.js';
import type { UsCrosswalkTableName } from '../us/table-names.js';

let usTables: UsCrosswalkTables | null = null;
let usLookups: UsTableLookups | null = null;
const loadedTableNames = new Set<UsCrosswalkTableName>();

export function clearUsCrosswalkRegistry(): void {
  usTables = null;
  usLookups = null;
  loadedTableNames.clear();
}

export function setUsCrosswalkRegistry(
  tables: UsCrosswalkTables,
  lookups: UsTableLookups,
  newlyLoaded: readonly UsCrosswalkTableName[]
): void {
  usTables = tables;
  usLookups = lookups;
  for (const name of newlyLoaded) {
    loadedTableNames.add(name);
  }
}

export function isCrosswalkTableLoaded(name: UsCrosswalkTableName): boolean {
  return loadedTableNames.has(name);
}

export function getLoadedCrosswalkTableNames(): readonly UsCrosswalkTableName[] {
  return [...loadedTableNames];
}

export function getUsCrosswalkLookups(): UsTableLookups | null {
  return usLookups;
}

export function isCrosswalkCountryLoaded(country: CrosswalkCountry): boolean {
  if (country === 'us') return usLookups !== null;
  return false;
}

export function requireUsCrosswalkLookups(): UsTableLookups {
  if (!usLookups) {
    throw new Error(
      'US crosswalk tables not loaded. Import @geokit/crosswalk/us or call loadCrosswalk("us").'
    );
  }
  return usLookups;
}

export function getUsCrosswalkTables(): UsCrosswalkTables | null {
  return usTables;
}
