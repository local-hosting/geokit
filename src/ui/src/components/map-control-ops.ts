/**
 * MapLibre / Mapbox control APIs require `this` = the map instance.
 * Always invoke via `.call(map, …)` — never extract and call unbound.
 */

export type MapWithControls = {
  removeControl?: (control: unknown) => void;
  addControl?: (control: unknown, position: string) => void;
};

export function mapSupportsAddControl(map: MapWithControls): boolean {
  return typeof map.addControl === 'function';
}

export function removeControlFromMap(map: MapWithControls, control: unknown): void {
  map.removeControl?.call(map, control);
}

export function addControlToMapInstance(
  map: MapWithControls,
  control: unknown,
  position: string
): void {
  map.addControl?.call(map, control, position);
}
