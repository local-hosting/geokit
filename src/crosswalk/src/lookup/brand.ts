import type {
  CountyFips,
  GeohashPoint,
  H3Point,
  MacroRegion,
  StateCode,
  ZipCode,
} from '@twinfile/geokit/core';
import {
  asCountyFipsOrUndefined,
  asGeohashPoint,
  asH3Point,
  asMacroRegionOrUndefined,
  asStateCodeOrUndefined,
  asZipCodeOrUndefined,
} from '@twinfile/geokit/core';
import { compactH3CellId, expandH3CellId } from '../h3/cell-id';
import { geohashCellIdForLookup } from '../geohash/cell-id';

function uniqSortedBranded<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)].sort() as readonly T[];
}

export function brandZipList(zips: readonly string[]): readonly ZipCode[] {
  const out: ZipCode[] = [];
  for (const raw of zips) {
    const zip = asZipCodeOrUndefined(raw);
    if (zip) out.push(zip);
  }
  return uniqSortedBranded(out);
}

export function brandH3List(cells: readonly string[]): readonly H3Point[] {
  return uniqSortedBranded(cells.map((cell) => asH3Point(expandH3CellId(compactH3CellId(cell)))));
}

export function brandGeohashList(cells: readonly string[]): readonly GeohashPoint[] {
  return uniqSortedBranded(cells.map((cell) => asGeohashPoint(geohashCellIdForLookup(cell))));
}

export function brandStateList(states: readonly string[]): readonly StateCode[] {
  const out: StateCode[] = [];
  for (const raw of states) {
    const state = asStateCodeOrUndefined(raw);
    if (state) out.push(state);
  }
  return uniqSortedBranded(out);
}

export function brandCountyList(fips: readonly string[]): readonly CountyFips[] {
  const out: CountyFips[] = [];
  for (const raw of fips) {
    const county = asCountyFipsOrUndefined(raw);
    if (county) out.push(county);
  }
  return uniqSortedBranded(out);
}

export function optionalMacroRegion(value: MacroRegion | undefined): readonly MacroRegion[] {
  return value ? [value] : [];
}
