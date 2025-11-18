declare module 'latlon-geohash' {
  interface LatLon {
    lat: number;
    lon: number;
  }

  interface Bounds {
    sw: LatLon;
    ne: LatLon;
  }

  interface Neighbours {
    n: string;
    ne: string;
    e: string;
    se: string;
    s: string;
    sw: string;
    w: string;
    nw: string;
  }

  namespace Geohash {
    function encode(lat: number, lon: number, precision?: number): string;
    function decode(geohash: string): LatLon;
    function bounds(geohash: string): Bounds;
    function adjacent(geohash: string, direction: 'n' | 's' | 'e' | 'w'): string;
    function neighbours(geohash: string): Neighbours;
  }

  export = Geohash;
}
