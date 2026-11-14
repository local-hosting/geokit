import { describe, it, expect } from 'vitest';
import {
  addControlToMapInstance,
  mapSupportsAddControl,
  removeControlFromMap,
} from '../../../src/components/map-control-ops';

/** Mimics MapLibre: unbound removeControl/addControl throw on this._controls. */
function createStrictMap() {
  return {
    _controls: [] as unknown[],
    removeControl(this: { _controls: unknown[] }, control: unknown) {
      if (this === undefined || this === null || !Array.isArray(this._controls)) {
        throw new TypeError("Cannot read properties of undefined (reading '_controls')");
      }
      this._controls = this._controls.filter((c) => c !== control);
    },
    addControl(this: { _controls: unknown[] }, control: unknown, _position: string) {
      if (this === undefined || this === null || !Array.isArray(this._controls)) {
        throw new TypeError("Cannot read properties of undefined (reading '_controls')");
      }
      this._controls.push(control);
    },
  };
}

describe('map-control-ops', () => {
  it('mapSupportsAddControl detects addControl', () => {
    expect(mapSupportsAddControl(createStrictMap())).toBe(true);
    expect(mapSupportsAddControl({})).toBe(false);
  });

  it('removeControlFromMap binds this to the map (avoids _controls TypeError)', () => {
    const map = createStrictMap();
    const control = { id: 'nav' };
    map._controls.push(control);

    expect(() => removeControlFromMap(map, control)).not.toThrow();
    expect(map._controls).toEqual([]);
  });

  it('addControlToMapInstance binds this to the map', () => {
    const map = createStrictMap();
    const control = { id: 'nav' };

    expect(() => addControlToMapInstance(map, control, 'top-right')).not.toThrow();
    expect(map._controls).toEqual([control]);
  });

  it('unbound removeControl reproduces the NavigationControl crash', () => {
    const map = createStrictMap();
    const control = { id: 'nav' };
    map._controls.push(control);
    const unbound = map.removeControl;

    expect(() => unbound(control)).toThrow(
      /Cannot read properties of undefined \(reading '_controls'\)/
    );
  });
});
