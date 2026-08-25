import type { UsCrosswalkTableName } from './us/table-names.js';

export type LatLon = readonly [number, number];

export type CrosswalkCountry = 'us';

export type GeoKind =
  | 'country'
  | 'h3'
  | 'geohash'
  | 'zip'
  | 'dma'
  | 'region'
  | 'state'
  | 'county';

export type CrosswalkResult = {
  readonly country: readonly string[];
  readonly point?: LatLon;
  readonly h3?: readonly string[];
  readonly geohash?: readonly string[];
  readonly zip?: readonly string[];
  readonly dma?: readonly string[];
  readonly region?: readonly string[];
  readonly state?: readonly string[];
  readonly county?: readonly string[];
};

export type CrosswalkInput =
  | { lat: number; lon: number }
  | { h3Cell: string }
  | { geohash: string }
  | { zip: string }
  | { dmaSlug: string }
  | { countyFips: string }
  | { placeKey: string }
  | { state: string; placeSlug: string };

export type CrosswalkSpine = 'h3' | 'geohash';

export type { UsCrosswalkTableName };

export type LoadCrosswalkOptions = {
  spine?: CrosswalkSpine;
  tables?: readonly UsCrosswalkTableName[];
  projectH3?: boolean;
};

export type PlaceToDmaEntry = {
  dmaSlug: string;
  region: string;
};

export type UsCrosswalkTables = {
  h3ToDma: Readonly<Record<string, string>>;
  h3R5ToZips: Readonly<Record<string, readonly string[]>>;
  zipToH3R5: Readonly<Record<string, string>>;
  geohashToDma: Readonly<Record<string, string>>;
  geohashP8ToZips: Readonly<Record<string, readonly string[]>>;
  zipToGeohashP8: Readonly<Record<string, string>>;
  dmaToZips: Readonly<Record<string, readonly string[]>>;
  dmaToCounties?: Readonly<Record<string, readonly string[]>>;
  countyToDma?: Readonly<Record<string, string>>;
  dmaRegion?: Readonly<Record<string, string>>;
  zipToState?: Readonly<Record<string, string>>;
  placeToDma?: Readonly<Record<string, PlaceToDmaEntry>>;
};
