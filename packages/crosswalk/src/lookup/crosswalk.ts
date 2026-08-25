import type {
  CrosswalkCountry,
  CrosswalkInput,
  CrosswalkResult,
  CrosswalkSpine,
  GeoKind,
  LatLon,
} from '../types.js';
import { geohashCellIdForLookup } from '../geohash/cell-id.js';
import { geohashCellToLatLon, geohashForLatLon, geohashForPoint } from './geohash.js';
import { compactH3CellId } from '../h3/cell-id.js';
import { h3CellToLatLng, latLngToH3Cell, isH3ProjectionLoaded } from '../h3/project.js';
import { requireUsCrosswalkLookups, getCrosswalkSpine } from '../load/registry.js';

const DEFAULT_H3_RESOLUTION = 5;

export type CrosswalkOptions = {
  country?: CrosswalkCountry;
  to?: readonly GeoKind[];
  spine?: CrosswalkSpine;
};

function isLatLonInput(input: CrosswalkInput): input is { lat: number; lon: number } {
  return 'lat' in input && 'lon' in input;
}

function isH3Input(input: CrosswalkInput): input is { h3Cell: string } {
  return 'h3Cell' in input;
}

function isGeohashInput(input: CrosswalkInput): input is { geohash: string } {
  return 'geohash' in input;
}

function isZipInput(input: CrosswalkInput): input is { zip: string } {
  return 'zip' in input;
}

function isDmaInput(input: CrosswalkInput): input is { dmaSlug: string } {
  return 'dmaSlug' in input;
}

function isCountyInput(input: CrosswalkInput): input is { countyFips: string } {
  return 'countyFips' in input;
}

function isPlaceKeyInput(input: CrosswalkInput): input is { placeKey: string } {
  return 'placeKey' in input;
}

function isStatePlaceInput(input: CrosswalkInput): input is { state: string; placeSlug: string } {
  return 'state' in input && 'placeSlug' in input;
}

function normalizePlaceKey(input: { placeKey: string } | { state: string; placeSlug: string }): string {
  if (isPlaceKeyInput(input)) {
    return input.placeKey.trim().toLowerCase();
  }
  return `${input.state.trim().toLowerCase()}/${input.placeSlug.trim().toLowerCase()}`;
}

function resolveSpine(options: CrosswalkOptions): CrosswalkSpine {
  return options.spine ?? getCrosswalkSpine();
}

function uniqSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((v) => v.length > 0))].sort();
}

function optionalOne(value: string | undefined): readonly string[] {
  return value ? [value] : [];
}

function statesForZips(
  lookups: ReturnType<typeof requireUsCrosswalkLookups>,
  zips: readonly string[]
): readonly string[] {
  return uniqSorted(
    zips.map((zip) => lookups.stateForZip(zip)).filter((s): s is string => Boolean(s))
  );
}

function shouldInclude(kind: GeoKind, to: readonly GeoKind[] | undefined): boolean {
  return !to || to.includes(kind);
}

function pickFields(
  result: CrosswalkResult,
  to: readonly GeoKind[] | undefined
): CrosswalkResult {
  if (!to) return result;
  return {
    country: result.country,
    ...(shouldInclude('h3', to) && result.h3 ? { h3: result.h3 } : {}),
    ...(shouldInclude('geohash', to) && result.geohash ? { geohash: result.geohash } : {}),
    ...(shouldInclude('zip', to) && result.zip ? { zip: result.zip } : {}),
    ...(shouldInclude('dma', to) && result.dma ? { dma: result.dma } : {}),
    ...(shouldInclude('region', to) && result.region ? { region: result.region } : {}),
    ...(shouldInclude('state', to) && result.state ? { state: result.state } : {}),
    ...(shouldInclude('county', to) && result.county ? { county: result.county } : {}),
    ...(result.point ? { point: result.point } : {}),
  };
}

function expandFromH3Cell(
  lookups: ReturnType<typeof requireUsCrosswalkLookups>,
  h3Cell: string,
  point?: LatLon
): Omit<CrosswalkResult, 'country'> {
  const h3 = compactH3CellId(h3Cell);
  const zips = lookups.zipsForH3(h3);
  const dma = lookups.dmaForH3(h3);
  const resolvedPoint = point ?? h3CellToLatLng(h3);
  const geohash = geohashForLatLon(resolvedPoint);
  const region = dma ? lookups.dmaRegionForDma(dma) : undefined;

  return {
    point: resolvedPoint,
    h3: [h3],
    geohash: [geohash],
    zip: uniqSorted(zips),
    dma: optionalOne(dma),
    region: optionalOne(region),
    state: statesForZips(lookups, zips),
  };
}

function expandFromGeohashCell(
  lookups: ReturnType<typeof requireUsCrosswalkLookups>,
  geohashCell: string,
  point?: LatLon
): Omit<CrosswalkResult, 'country'> {
  const geohash = geohashCellIdForLookup(geohashCell);
  const zips = lookups.zipsForGeohash(geohash);
  const dma = lookups.dmaForGeohash(geohash);
  const resolvedPoint = point ?? geohashCellToLatLon(geohash);
  const region = dma ? lookups.dmaRegionForDma(dma) : undefined;
  let h3: readonly string[] | undefined;
  if (isH3ProjectionLoaded()) {
    h3 = [latLngToH3Cell(resolvedPoint[0], resolvedPoint[1], DEFAULT_H3_RESOLUTION)];
  }

  return {
    point: resolvedPoint,
    ...(h3 ? { h3 } : {}),
    geohash: [geohash],
    zip: uniqSorted(zips),
    dma: optionalOne(dma),
    region: optionalOne(region),
    state: statesForZips(lookups, zips),
  };
}

export function crosswalk(from: CrosswalkInput, options: CrosswalkOptions = {}): CrosswalkResult {
  const lookups = requireUsCrosswalkLookups();
  const country = options.country ?? 'us';
  const spine = resolveSpine(options);
  let partial: Omit<CrosswalkResult, 'country'>;

  if (isLatLonInput(from)) {
    if (spine === 'geohash') {
      const geohash = geohashForPoint(from.lat, from.lon);
      partial = expandFromGeohashCell(lookups, geohash, [from.lat, from.lon]);
    } else {
      if (!isH3ProjectionLoaded()) {
        throw new Error(
          'H3 projection required for lat/lon crosswalk. Call loadCrosswalk("us") first.'
        );
      }
      const h3 = latLngToH3Cell(from.lat, from.lon, DEFAULT_H3_RESOLUTION);
      partial = expandFromH3Cell(lookups, h3, [from.lat, from.lon]);
    }
  } else if (isH3Input(from)) {
    partial = expandFromH3Cell(lookups, from.h3Cell);
  } else if (isGeohashInput(from)) {
    partial = expandFromGeohashCell(lookups, from.geohash);
  } else if (isZipInput(from)) {
    if (spine === 'geohash') {
      const geohash = lookups.geohashForZip(from.zip);
      if (!geohash) {
        throw new Error(`Unknown ZIP for crosswalk: ${from.zip}`);
      }
      partial = expandFromGeohashCell(lookups, geohash);
    } else {
      const h3 = lookups.h3ForZip(from.zip);
      if (!h3) {
        throw new Error(`Unknown ZIP for crosswalk: ${from.zip}`);
      }
      partial = expandFromH3Cell(lookups, h3);
    }
    const zip = from.zip.trim();
    if (!partial.zip?.includes(zip)) {
      partial = { ...partial, zip: uniqSorted([zip, ...(partial.zip ?? [])]) };
    }
  } else if (isDmaInput(from)) {
    const dma = from.dmaSlug.trim().toLowerCase();
    const zips = lookups.zipsInDma(dma);
    const counties = lookups.countiesInDma(dma);
    const region = lookups.dmaRegionForDma(dma);
    partial = {
      dma: dma ? [dma] : [],
      zip: uniqSorted(zips),
      county: uniqSorted(counties),
      region: optionalOne(region),
      state: statesForZips(lookups, zips),
    };
  } else if (isCountyInput(from)) {
    const fips = from.countyFips.trim();
    const dma = lookups.dmaForCountyFips(fips);
    partial = {
      county: fips ? [fips] : [],
      dma: optionalOne(dma),
      region: dma ? optionalOne(lookups.dmaRegionForDma(dma)) : [],
    };
    if (dma) {
      const dmaZips = lookups.zipsInDma(dma);
      const dmaCounties = lookups.countiesInDma(dma);
      partial = {
        ...partial,
        zip: uniqSorted(dmaZips),
        county: uniqSorted([...(partial.county ?? []), ...dmaCounties]),
        state: statesForZips(lookups, dmaZips),
      };
    }
  } else if (isPlaceKeyInput(from) || isStatePlaceInput(from)) {
    const placeKey = normalizePlaceKey(from);
    const entry = lookups.placeToDma(placeKey);
    if (!entry) {
      throw new Error(`Unknown place for crosswalk: ${placeKey}`);
    }
    const dma = entry.dmaSlug;
    const zips = lookups.zipsInDma(dma);
    partial = {
      dma: [dma],
      region: optionalOne(entry.region),
      zip: uniqSorted(zips),
      state: statesForZips(lookups, zips),
    };
  } else {
    throw new Error('Unsupported CrosswalkInput');
  }

  return pickFields({ country: [country], ...partial }, options.to);
}
