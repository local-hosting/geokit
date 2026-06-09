/**
 * MapLibre fill-antialias heuristic — earcut fold artifacts vs choropleth seams.
 */

type FillAntialiasMap =
  | {
      getPitch?: () => number;
      getTerrain?: () => unknown;
    }
  | null
  | undefined;

export type FillAntialiasOptions = {
  /** When true, always prefer antialiased fills (typical flat-map product mode). */
  preferAntialiasedWhenFlat?: boolean;
};

/**
 * While the map is flat, prefer antialiased fills to avoid earcut fold triangles when pitched.
 * With terrain on and flat pitch, non-antialiased fills can reduce inter-region seams.
 */
export function fillAntialiasForMap(
  map: FillAntialiasMap,
  options: FillAntialiasOptions = {}
): boolean {
  if (options.preferAntialiasedWhenFlat) return true;
  const pitch = map?.getPitch?.() ?? 0;
  const terrainActive = map?.getTerrain?.() !== undefined && map?.getTerrain?.() !== null;
  return pitch > 0.5 || terrainActive;
}
