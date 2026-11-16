import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
} from '@doppler-group/geokit/core';

export type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon };

export interface ShapefileReader {
  read(): Promise<{ done: boolean; value?: Feature }>;
}

export interface ConversionOptions {
  /** Filter features by property values */
  filter?: (properties: Record<string, unknown>) => boolean;
  /** Transform feature properties */
  transformProperties?: (properties: Record<string, unknown>) => Record<string, unknown>;
  /** Transform feature geometry */
  transformGeometry?: (geometry: Geometry) => Geometry | null;
}

export interface CSVConversionOptions extends ConversionOptions {
  /** Column name for H3 hexagon ID (auto-detected if not specified) */
  h3Column?: string;
  /** Column name for latitude (auto-detected if not specified) */
  latColumn?: string;
  /** Column name for longitude (auto-detected if not specified) */
  lonColumn?: string;
  /** H3 resolution to use when converting lat/lon to H3 (default: 8) */
  h3Resolution?: number;
  /** Disable auto-detection of columns */
  disableAutoDetect?: boolean;
  /** Column name for provider ID (optional) */
  providerIdColumn?: string;
  /** Column name for technology (optional) */
  technologyColumn?: string;
}
