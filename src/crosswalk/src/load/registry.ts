import type { CrosswalkCountry, CrosswalkSpine, UsCrosswalkTables } from '../types';
import type { UsTableLookups } from '../us/tables';
import type { UsCrosswalkTableName } from '../us/table-names';
import { clearCountyBoundaries } from '../us/county-boundaries';

let usTables: UsCrosswalkTables | null = null;
let usLookups: UsTableLookups | null = null;
let crosswalkSpine: CrosswalkSpine = 'h3';
const loadedTableNames = new Set<UsCrosswalkTableName>();

export function clearUsCrosswalkRegistry(): void {
  usTables = null;
  usLookups = null;
  crosswalkSpine = 'h3';
  loadedTableNames.clear();
  clearCountyBoundaries();
}

export function setUsCrosswalkRegistry(
  tables: UsCrosswalkTables,
  lookups: UsTableLookups,
  newlyLoaded: readonly UsCrosswalkTableName[],
  spine?: CrosswalkSpine
): void {
  usTables = tables;
  usLookups = lookups;
  if (spine) crosswalkSpine = spine;
  for (const name of newlyLoaded) {
    loadedTableNames.add(name);
  }
}

export function getCrosswalkSpine(): CrosswalkSpine {
  return crosswalkSpine;
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
      'US crosswalk tables not loaded. Import @twinfile/geokit/crosswalk/us or call loadCrosswalk("us").'
    );
  }
  return usLookups;
}

export function getUsCrosswalkTables(): UsCrosswalkTables | null {
  return usTables;
}
