import type { LoadCrosswalkOptions } from '../types';
import { ensureH3Projection } from '../h3/project';
import { clearUsCrosswalkRegistry } from './registry';
import { loadUsCrosswalkTableNames } from '../us/load-tables';
import { loadAllUsCrosswalkTablesSync } from '../us/load-tables-sync';
import { US_CROSSWALK_TABLE_NAMES } from '../us/table-names';

export function resetCrosswalkForTest(): void {
  clearUsCrosswalkRegistry();
}

function resolveTableNames(options: LoadCrosswalkOptions): readonly typeof US_CROSSWALK_TABLE_NAMES[number][] {
  return options.tables ?? US_CROSSWALK_TABLE_NAMES;
}

function shouldProjectH3(options: LoadCrosswalkOptions): boolean {
  if (options.projectH3 !== undefined) return options.projectH3;
  if (options.spine === 'geohash') return false;
  return options.spine === 'h3' || options.spine === undefined;
}

export async function loadUsCrosswalk(options: LoadCrosswalkOptions = {}): Promise<void> {
  await loadUsCrosswalkTableNames(resolveTableNames(options), options.spine);
  if (shouldProjectH3(options)) {
    await ensureH3Projection();
  }
}

export function loadUsCrosswalkSync(spine?: LoadCrosswalkOptions['spine']): void {
  loadAllUsCrosswalkTablesSync(spine);
}

export async function loadCrosswalk(
  scope: string,
  options: LoadCrosswalkOptions = {}
): Promise<void> {
  if (scope === 'us' || scope.startsWith('us/')) {
    await loadUsCrosswalk(options);
    return;
  }
  throw new Error(`Unknown crosswalk scope: ${scope}`);
}
