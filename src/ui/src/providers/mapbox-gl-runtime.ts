export type MapboxGlRuntime = {
  Map: new (...args: unknown[]) => unknown;
  NavigationControl?: new (...args: unknown[]) => unknown;
  ScaleControl?: new (...args: unknown[]) => unknown;
  FullscreenControl?: new (...args: unknown[]) => unknown;
  Marker?: new (...args: unknown[]) => unknown;
  Popup?: new (...args: unknown[]) => unknown;
  accessToken?: string;
};

/** Normalize Vite/Rollup/CJS interop shapes from `import('mapbox-gl')`. */
export function resolveMapboxGlRuntime(imported: unknown): MapboxGlRuntime {
  const candidates: unknown[] = [];
  if (imported != null) {
    candidates.push(imported);
    if (typeof imported === 'object') {
      const rec = imported as Record<string, unknown>;
      if (rec.default != null) candidates.push(rec.default);
      const nested = rec.module as { exports?: unknown } | undefined;
      if (nested?.exports != null) candidates.push(nested.exports);
    }
  }
  for (const candidate of candidates) {
    if (candidate != null && typeof candidate === 'object') {
      const MapCtor = (candidate as MapboxGlRuntime).Map;
      if (typeof MapCtor === 'function') {
        return candidate as MapboxGlRuntime;
      }
    }
  }
  throw new Error('Mapbox GL JS Map constructor not found after import');
}