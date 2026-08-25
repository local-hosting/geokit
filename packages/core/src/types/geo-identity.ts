import type {
  GeohashArea,
  GeohashPoint,
  H3Area,
  H3Point,
  SpatialIndex,
} from './spatial-index';

/** WGS84 point as [latitude, longitude] — same layout as {@link LatLon}. */
export type GeoPoint = readonly [number, number];

/** US ZIP code (5-digit, zero-padded when normalized). */
export type ZipCode = string & { __brand: 'ZipCode' };

/** Canonical Nielsen DMA slug (lowercase kebab-case). */
export type DmaSlug = string & { __brand: 'DmaSlug' };

/** US county FIPS code (5-digit, zero-padded when normalized). */
export type CountyFips = string & { __brand: 'CountyFips' };

/** US state/territory abbreviation (lowercase). */
export type StateCode = string & { __brand: 'StateCode' };

/** Place crosswalk key (`state/place-slug`, lowercase). */
export type PlaceKey = string & { __brand: 'PlaceKey' };

/** Fieldwise macro-region slug (lowercase kebab-case). */
export type MacroRegion = string & { __brand: 'MacroRegion' };

/** ISO-like country code used in crosswalk (lowercase). */
export type CountryCode = string & { __brand: 'CountryCode' };

/** Nielsen DMA identity — slug + macro-region. */
export type DMA = {
  readonly slug: DmaSlug;
  readonly region: MacroRegion;
};

/** Kinds of geo identities that can be converted or crosswalked. */
export const GeoKind = {
  Country: 'country',
  Point: 'point',
  H3: 'h3',
  Geohash: 'geohash',
  Zip: 'zip',
  DMA: 'dma',
  Region: 'region',
  State: 'state',
  County: 'county',
  Place: 'place',
} as const;

export type GeoKind = (typeof GeoKind)[keyof typeof GeoKind];

/** Tagged geo identity — formal input/output primitive for conversion. */
export type GeoRef =
  | { readonly kind: 'country'; readonly value: CountryCode }
  | { readonly kind: 'point'; readonly value: GeoPoint }
  | { readonly kind: 'h3'; readonly value: H3Point }
  | { readonly kind: 'geohash'; readonly value: GeohashPoint }
  | { readonly kind: 'zip'; readonly value: ZipCode }
  | { readonly kind: 'dma'; readonly value: DMA }
  | { readonly kind: 'dmaSlug'; readonly value: DmaSlug }
  | { readonly kind: 'region'; readonly value: MacroRegion }
  | { readonly kind: 'state'; readonly value: StateCode }
  | { readonly kind: 'county'; readonly value: CountyFips }
  | { readonly kind: 'place'; readonly value: PlaceKey };

/** @deprecated Use {@link GeoRef} factories (`Zip()`, `latLng()`, `H3()`, …). */
export type GeoRefInput =
  | GeoRef
  | { lat: number; lon: number }
  | { h3Cell: string | H3Point }
  | { geohash: string | GeohashPoint }
  | { zip: string | ZipCode }
  | { dmaSlug: string | DmaSlug }
  | { countyFips: string | CountyFips }
  | { placeKey: string | PlaceKey }
  | { state: string | StateCode; placeSlug: string };

/** Catalog/admin string identities (non-geometry). */
export type CatalogIdentity =
  | ZipCode
  | DmaSlug
  | CountyFips
  | StateCode
  | PlaceKey
  | MacroRegion
  | CountryCode;

/** All discrete geo identities: spatial indexes + catalog slugs + DMA records. */
export type GeoIdentity = SpatialIndex | GeohashArea | H3Area | CatalogIdentity | DMA;

/** Single-field output type for `convert(from, kind)`. */
export type ConvertOutput<K extends GeoKind> = K extends 'country'
  ? CountryCode | undefined
  : K extends 'point'
    ? GeoPoint | undefined
    : K extends 'h3'
      ? readonly H3Point[] | undefined
      : K extends 'geohash'
        ? readonly GeohashPoint[] | undefined
        : K extends 'zip'
          ? readonly ZipCode[] | undefined
          : K extends 'dma'
            ? DMA | undefined
            : K extends 'region'
              ? MacroRegion | undefined
              : K extends 'state'
                ? readonly StateCode[] | undefined
                : K extends 'county'
                  ? readonly CountyFips[] | undefined
                  : K extends 'place'
                    ? DMA | undefined
                    : never;
