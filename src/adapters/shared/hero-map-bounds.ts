/** CONUS hero map bounds + optional intro zoom animation. */

export const HERO_CONUS_BOUNDS: [[number, number], [number, number]] = [
  [-190, 5],
  [-45, 65],
];

type MapBoundsLike = {
  setMinZoom?: (zoom: number) => void;
  setMaxBounds?: (bounds: [[number, number], [number, number]]) => void;
  easeTo?: (opts: { zoom?: number; duration?: number }) => void;
};

export function applyHeroConusBounds(
  map: MapBoundsLike | null | undefined,
  options: { minZoom?: number; animateToZoom?: number; animate?: boolean } = {}
): void {
  if (!map) return;
  const minZoom = options.minZoom ?? 3;
  map.setMinZoom?.(minZoom);
  map.setMaxBounds?.(HERO_CONUS_BOUNDS);
  if (options.animate && options.animateToZoom !== undefined) {
    requestAnimationFrame(() => {
      map.easeTo?.({ zoom: options.animateToZoom, duration: 1800 });
    });
  }
}
