import type { LoadCrosswalkOptions } from '../types.js';
import { ensureH3Projection } from '../h3/project.js';
import { clearUsCrosswalkRegistry } from './registry.js';
import { loadUsCrosswalkTableNames } from '../us/load-tables.js';
import { loadAllUsCrosswalkTablesSync } from '../us/load-tables-sync.js';
import { US_CROSSWALK_TABLE_NAMES } from '../us/table-names.js';

export function resetCrosswalkForTest(): void {
  clearUsCrosswalkRegistry();
}

function resolveTableNames(options: LoadCrosswalkOptions): readonly typeof US_CROSSWALK_TABLE_NAMES[number][] {
  return options.tables ?? US_CROSSWALK_TABLE_NAMES;
}

function shouldProjectH3(options: LoadCrosswalkOptions): boolean {
  if (options.projectH3 !== undefined) return options.projectH3;
  return options.spine === 'h3' || options.spine === undefined;
}

export async function loadUsCrosswalk(options: LoadCrosswalkOptions = {}): Promise<void> {
  await loadUsCrosswalkTableNames(resolveTableNames(options));
  if (shouldProjectH3(options)) {
    await ensureH3Projection();
  }
}

export function loadUsCrosswalkSync(): void {
  loadAllUsCrosswalkTablesSync();
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
