import type {
  CountryCode,
  CountyFips,
  DMA,
  GeoPoint,
  GeoRef,
  GeohashPoint,
  H3Point,
  LatLon,
  MacroRegion,
  StateCode,
  ZipCode,
} from '@doppler-group/geokit/core';
import type { UsCrosswalkTableName } from './us/table-names';

export type { DMA, GeoRef, LatLon } from '@doppler-group/geokit/core';

/** @deprecated Use {@link GeoRef}. */
export type CrosswalkInput = GeoRef;

export type CrosswalkCountry = 'us';

export type CrosswalkResult = {
  readonly country: readonly CountryCode[];
  readonly point?: GeoPoint;
  readonly h3?: readonly H3Point[];
  readonly geohash?: readonly GeohashPoint[];
  readonly zip?: readonly ZipCode[];
  readonly dma?: readonly DMA[];
  readonly region?: readonly MacroRegion[];
  readonly state?: readonly StateCode[];
  readonly county?: readonly CountyFips[];
  readonly tract?: readonly string[];
};

export type CrosswalkSpine = 'h3' | 'geohash';

export type { UsCrosswalkTableName };

export type LoadCrosswalkOptions = {
  spine?: CrosswalkSpine;
  tables?: readonly UsCrosswalkTableName[];
  projectH3?: boolean;
};

export type PlaceToDmaEntry = {
  dmaSlug: string;
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
  zipToState?: Readonly<Record<string, string>>;
  placeToDma?: Readonly<Record<string, PlaceToDmaEntry>>;
  tractToH3R1?: Readonly<Record<string, string>>;
  h3R1ToTracts?: Readonly<Record<string, readonly string[]>>;
};
