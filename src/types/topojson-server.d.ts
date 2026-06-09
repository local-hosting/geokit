declare module 'topojson-server' {
  import type { Topology } from 'topojson-specification';
  import type { GeoJSON } from 'geojson';

  export function topology(
    objects: Record<string, GeoJSON.GeoJSON>,
    quantization?: number | false
  ): Topology;
}
