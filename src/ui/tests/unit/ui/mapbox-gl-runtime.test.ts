import { describe, expect, it } from 'vitest';
import { resolveMapboxGlRuntime } from '../../../src/providers/mapbox-gl-runtime';

describe('resolveMapboxGlRuntime', () => {
  const FakeMap = class Map {};

  it('uses default export when it exposes Map', () => {
    const runtime = resolveMapboxGlRuntime({ default: { Map: FakeMap } });
    expect(runtime.Map).toBe(FakeMap);
  });

  it('uses namespace import when Map is a named export', () => {
    const runtime = resolveMapboxGlRuntime({ Map: FakeMap, Marker: class Marker {} });
    expect(runtime.Map).toBe(FakeMap);
  });

  it('throws when no Map constructor is found', () => {
    expect(() => resolveMapboxGlRuntime({ default: {} })).toThrow(/Map constructor/);
  });
});