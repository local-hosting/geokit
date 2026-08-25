import type { GeoRef, GeoRefInput } from '../../types/geo-identity';
import {
  GKCounty,
  GKDMA,
  GKGeohash,
  GKH3,
  GKPlace,
  GKPoint,
  GKZip,
} from './refs';
import { placeKeyFromStateAndSlug } from './normalize';

function isGeoRef(input: GeoRefInput): input is GeoRef {
  return 'kind' in input && 'value' in input;
}

function isLatLonInput(input: GeoRefInput): input is { lat: number; lon: number } {
  return 'lat' in input && 'lon' in input;
}

function isH3Input(input: GeoRefInput): input is { h3Cell: string } {
  return 'h3Cell' in input;
}

function isGeohashInput(input: GeoRefInput): input is { geohash: string } {
  return 'geohash' in input;
}

function isZipInput(input: GeoRefInput): input is { zip: string } {
  return 'zip' in input;
}

function isDmaSlugInput(input: GeoRefInput): input is { dmaSlug: string } {
  return 'dmaSlug' in input;
}

function isCountyInput(input: GeoRefInput): input is { countyFips: string } {
  return 'countyFips' in input;
}

function isPlaceKeyInput(input: GeoRefInput): input is { placeKey: string } {
  return 'placeKey' in input;
}

function isStatePlaceInput(input: GeoRefInput): input is { state: string; placeSlug: string } {
  return 'state' in input && 'placeSlug' in input;
}

/** Parse loose geo identity input into a tagged {@link GeoRef}. */
export function parseGeoRef(input: GeoRefInput): GeoRef {
  if (isGeoRef(input)) return input;

  if (isLatLonInput(input)) {
    return GKPoint(input.lat, input.lon);
  }
  if (isH3Input(input)) {
    return GKH3(String(input.h3Cell));
  }
  if (isGeohashInput(input)) {
    return GKGeohash(String(input.geohash));
  }
  if (isZipInput(input)) {
    return GKZip(input.zip);
  }
  if (isDmaSlugInput(input)) {
    return GKDMA(input.dmaSlug);
  }
  if (isCountyInput(input)) {
    return GKCounty(input.countyFips);
  }
  if (isPlaceKeyInput(input)) {
    return GKPlace(input.placeKey);
  }
  if (isStatePlaceInput(input)) {
    const key = placeKeyFromStateAndSlug(input.state, input.placeSlug);
    if (!key) throw new Error(`Invalid place input: ${input.state}/${input.placeSlug}`);
    return GKPlace(key);
  }

  throw new Error('Unsupported GeoRefInput');
}
