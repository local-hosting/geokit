import { GeoKind, type ConvertOutput } from '@geokit/core';
import type { CrosswalkResult } from '../types';

export function pickConvertOutput<K extends GeoKind>(
  kind: K,
  result: CrosswalkResult
): ConvertOutput<K> {
  switch (kind) {
    case GeoKind.Country:
      return result.country[0] as ConvertOutput<K>;
    case GeoKind.Point:
      return result.point as ConvertOutput<K>;
    case GeoKind.H3:
      return result.h3 as ConvertOutput<K>;
    case GeoKind.Geohash:
      return result.geohash as ConvertOutput<K>;
    case GeoKind.Zip:
      return result.zip as ConvertOutput<K>;
    case GeoKind.DMA:
    case GeoKind.Place:
      return result.dma?.[0] as ConvertOutput<K>;
    case GeoKind.Region:
      return result.region?.[0] as ConvertOutput<K>;
    case GeoKind.State:
      return result.state as ConvertOutput<K>;
    case GeoKind.County:
      return result.county as ConvertOutput<K>;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
