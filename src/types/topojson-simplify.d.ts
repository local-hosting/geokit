declare module 'topojson-simplify' {
  import type { Topology } from 'topojson-specification';

  export function presimplify(
    topology: Topology,
    weight?: (triangle: [number, number][]) => number
  ): Topology;

  export function simplify(topology: Topology, minWeight?: number): Topology;

  export function quantile(topology: Topology, p: number): number;

  export function planarTriangleArea(triangle: [number, number][]): number;
}
