import {
  GeoKind,
  asCountryCode,
  type CountryCode,
  type DMA,
  type GeoPoint,
  type GeoRef,
  type MacroRegion,
} from '@geokit/core';
import type { CrosswalkCountry, CrosswalkResult, CrosswalkSpine } from '../types';
import { geohashCellIdForLookup } from '../geohash/cell-id';
import { geohashCellToLatLon, geohashForLatLon, geohashForPoint } from './geohash';
import { compactH3CellId } from '../h3/cell-id';
import { h3CellToLatLng, latLngToH3Cell, isH3ProjectionLoaded } from '../h3/project';
import { requireUsCrosswalkLookups, getCrosswalkSpine } from '../load/registry';
import {
  brandCountyList,
  brandGeohashList,
  brandH3List,
  brandStateList,
  brandZipList,
  optionalMacroRegion,
} from './brand';

const DEFAULT_H3_RESOLUTION = 5;

export type CrosswalkOptions = {
  country?: CrosswalkCountry;
  to?: readonly GeoKind[];
  spine?: CrosswalkSpine;
};

function resolveSpine(options: CrosswalkOptions): CrosswalkSpine {
  return options.spine ?? getCrosswalkSpine();
}

function optionalDMA(dma: DMA | undefined): readonly DMA[] {
  return dma ? [dma] : [];
}

function regionsFromDmas(dmas: readonly DMA[]): readonly MacroRegion[] {
  return [...new Set(dmas.map((dma) => dma.region))].sort() as readonly MacroRegion[];
}

function statesForZips(
  lookups: ReturnType<typeof requireUsCrosswalkLookups>,
  zips: readonly string[]
) {
  return brandStateList(
    zips.map((zip) => lookups.stateForZip(zip)).filter((s): s is string => Boolean(s))
  );
}

function shouldInclude(kind: GeoKind, to: readonly GeoKind[] | undefined): boolean {
  return !to || to.includes(kind);
}

function pickFields(result: CrosswalkResult, to: readonly GeoKind[] | undefined): CrosswalkResult {
  if (!to) return result;
  return {
    country: result.country,
    ...(shouldInclude(GeoKind.H3, to) && result.h3 ? { h3: result.h3 } : {}),
    ...(shouldInclude(GeoKind.Geohash, to) && result.geohash ? { geohash: result.geohash } : {}),
    ...(shouldInclude(GeoKind.Zip, to) && result.zip ? { zip: result.zip } : {}),
    ...(shouldInclude(GeoKind.DMA, to) && result.dma ? { dma: result.dma } : {}),
    ...(shouldInclude(GeoKind.Region, to) && result.region ? { region: result.region } : {}),
    ...(shouldInclude(GeoKind.State, to) && result.state ? { state: result.state } : {}),
    ...(shouldInclude(GeoKind.County, to) && result.county ? { county: result.county } : {}),
    ...(result.point ? { point: result.point } : {}),
  };
}

function expandFromPoint(
  lookups: ReturnType<typeof requireUsCrosswalkLookups>,
  lat: number,
  lon: number
): Omit<CrosswalkResult, 'country'> {
  const point: GeoPoint = [lat, lon];
  const dma = lookups.dmaFromPoint(lat, lon);
  if (isH3ProjectionLoaded()) {
    const h3Cell = latLngToH3Cell(lat, lon, DEFAULT_H3_RESOLUTION);
    const fromH3 = expandFromH3Cell(lookups, h3Cell, point);
    return {
      ...fromH3,
      dma: optionalDMA(dma),
      region: dma ? optionalMacroRegion(dma.region) : regionsFromDmas(fromH3.dma ?? []),
    };
  }
  const geohash = geohashForPoint(lat, lon);
  const fromGeohash = expandFromGeohashCell(lookups, geohash, point);
  return {
    ...fromGeohash,
    dma: optionalDMA(dma),
    region: dma ? optionalMacroRegion(dma.region) : regionsFromDmas(fromGeohash.dma ?? []),
  };
}

function expandFromH3Cell(
  lookups: ReturnType<typeof requireUsCrosswalkLookups>,
  h3Cell: string,
  point?: GeoPoint
): Omit<CrosswalkResult, 'country'> {
  const h3 = compactH3CellId(h3Cell);
  const zips = lookups.zipsForH3(h3);
  const dma = lookups.dmaFromH3(h3);
  const resolvedPoint = point ?? (h3CellToLatLng(h3) as GeoPoint);
  const geohash = geohashForLatLon(resolvedPoint);

  return {
    point: resolvedPoint,
    h3: brandH3List([h3]),
    geohash: brandGeohashList([geohash]),
    zip: brandZipList(zips),
    dma: optionalDMA(dma),
    region: dma ? optionalMacroRegion(dma.region) : [],
    state: statesForZips(lookups, zips),
  };
}

function expandFromGeohashCell(
  lookups: ReturnType<typeof requireUsCrosswalkLookups>,
  geohashCell: string,
  point?: GeoPoint
): Omit<CrosswalkResult, 'country'> {
  const geohash = geohashCellIdForLookup(geohashCell);
  const zips = lookups.zipsForGeohash(geohash);
  const dma = lookups.dmaFromGeohash(geohash);
  const resolvedPoint = point ?? (geohashCellToLatLon(geohash) as GeoPoint);
  const h3 = isH3ProjectionLoaded()
    ? brandH3List([latLngToH3Cell(resolvedPoint[0], resolvedPoint[1], DEFAULT_H3_RESOLUTION)])
    : undefined;

  return {
    point: resolvedPoint,
    ...(h3 ? { h3 } : {}),
    geohash: brandGeohashList([geohash]),
    zip: brandZipList(zips),
    dma: optionalDMA(dma),
    region: dma ? optionalMacroRegion(dma.region) : [],
    state: statesForZips(lookups, zips),
  };
}

function expandFromDmaSlug(
  lookups: ReturnType<typeof requireUsCrosswalkLookups>,
  dmaSlug: string
): Omit<CrosswalkResult, 'country'> {
  const dma = lookups.dmaFromSlug(dmaSlug);
  const zips = lookups.zipsInDMA(dmaSlug);
  const counties = lookups.countiesInDMA(dmaSlug);
  return {
    dma: optionalDMA(dma),
    zip: brandZipList(zips),
    county: brandCountyList(counties),
    region: dma ? optionalMacroRegion(dma.region) : [],
    state: statesForZips(lookups, zips),
  };
}

export function crosswalk(from: GeoRef, options: CrosswalkOptions = {}): CrosswalkResult {
  const lookups = requireUsCrosswalkLookups();
  const country: CountryCode = asCountryCode(options.country ?? 'us');
  const spine = resolveSpine(options);
  let partial: Omit<CrosswalkResult, 'country'>;

  switch (from.kind) {
    case GeoKind.Point:
      partial = expandFromPoint(lookups, from.value[0], from.value[1]);
      break;
    case GeoKind.H3:
      partial = expandFromH3Cell(lookups, from.value);
      break;
    case GeoKind.Geohash:
      partial = expandFromGeohashCell(lookups, from.value);
      break;
    case GeoKind.Zip: {
      const zip = from.value;
      if (spine === 'geohash') {
        const geohash = lookups.geohashForZip(zip);
        if (!geohash) throw new Error(`Unknown ZIP for crosswalk: ${zip}`);
        partial = expandFromGeohashCell(lookups, geohash);
      } else {
        const h3 = lookups.h3ForZip(zip);
        if (!h3) throw new Error(`Unknown ZIP for crosswalk: ${zip}`);
        partial = expandFromH3Cell(lookups, h3);
      }
      if (!partial.zip?.includes(zip)) {
        partial = { ...partial, zip: brandZipList([zip, ...(partial.zip ?? [])]) };
      }
      break;
    }
    case 'dmaSlug':
      partial = expandFromDmaSlug(lookups, from.value);
      break;
    case GeoKind.DMA:
      partial = expandFromDmaSlug(lookups, from.value.slug);
      break;
    case GeoKind.County: {
      const fips = from.value;
      const dma = lookups.dmaFromCounty(fips);
      partial = {
        county: brandCountyList([fips]),
        dma: optionalDMA(dma),
        region: dma ? optionalMacroRegion(dma.region) : [],
      };
      if (dma) {
        const dmaZips = lookups.zipsInDMA(dma.slug);
        const dmaCounties = lookups.countiesInDMA(dma.slug);
        partial = {
          ...partial,
          zip: brandZipList(dmaZips),
          county: brandCountyList([...(partial.county ?? []), ...dmaCounties]),
          state: statesForZips(lookups, dmaZips),
        };
      }
      break;
    }
    case GeoKind.Place: {
      const dma = lookups.dmaFromPlace(from.value);
      if (!dma) throw new Error(`Unknown place for crosswalk: ${from.value}`);
      const zips = lookups.zipsInDMA(dma.slug);
      partial = {
        dma: [dma],
        region: optionalMacroRegion(dma.region),
        zip: brandZipList(zips),
        state: statesForZips(lookups, zips),
      };
      break;
    }
    case GeoKind.Country:
      partial = {};
      break;
    case GeoKind.Region:
      partial = {};
      break;
    case GeoKind.State:
      partial = {};
      break;
    default: {
      const _exhaustive: never = from;
      throw new Error(`Unsupported GeoRef: ${(_exhaustive as GeoRef).kind}`);
    }
  }

  return pickFields({ country: [country], ...partial }, options.to);
}
