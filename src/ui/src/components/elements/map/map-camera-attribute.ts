import type { MapInstance } from '../../../providers/types';

export type MapCameraAttribute = 'lat' | 'lng' | 'zoom' | 'pitch' | 'bearing';

/**
 * Apply a camera attribute on the live map.
 * MapLibre methods read `this` (for example `setCenter` calls `this.jumpTo`).
 */
export function applyMapCameraAttribute(
  map: MapInstance,
  name: MapCameraAttribute,
  lat: string | null,
  lng: string | null,
  value: string | null,
): void {
  switch (name) {
    case 'lat':
    case 'lng':
      invoke(map, 'setCenter', [parseFloat(lng || '0'), parseFloat(lat || '0')]);
      return;
    case 'zoom':
      if (value) invoke(map, 'setZoom', parseFloat(value));
      return;
    case 'pitch':
      if (value) invoke(map, 'setPitch', parseFloat(value));
      return;
    case 'bearing':
      if (value) invoke(map, 'setBearing', parseFloat(value));
      return;
    default: {
      const unreachable: never = name;
      throw new Error(`Unknown camera attribute ${String(unreachable)}`);
    }
  }
}

function invoke(map: MapInstance, method: string, arg: unknown): void {
  const fn = map[method];
  if (typeof fn !== 'function') return;
  fn.call(map, arg);
}
