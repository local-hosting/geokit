/**
 * Provider CSS detection for Vite (injected `<style>` tags have no `href`).
 * Mapbox detects its own CSS via `.mapboxgl-canary { background-color: salmon }`.
 */

/** True when Mapbox GL layout CSS is present (Vite-injected CSS has no href). */
export function isMapboxGlCssLoaded(): boolean {
  if (typeof document === 'undefined') return false;
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        const selector = (rule as CSSStyleRule).selectorText;
        if (selector?.includes('.mapboxgl-canary')) return true;
      }
    } catch {
      // Cross-origin stylesheets
    }
  }
  return false;
}

/** Import mapbox-gl.css when the canary rule is not yet in the document. */
export async function ensureMapboxGlCss(): Promise<void> {
  if (isMapboxGlCssLoaded()) return;
  await import('mapbox-gl/dist/mapbox-gl.css');
}

/** MapLibre layout CSS (Protomaps / MapTiler stack) — idempotent under concurrent bootstrap. */
let maplibreCssPromise: Promise<void> | null = null;

export function ensureMaplibreGlCss(): Promise<void> {
  if (!maplibreCssPromise) {
    maplibreCssPromise = import('maplibre-gl/dist/maplibre-gl.css').then(() => undefined);
  }
  return maplibreCssPromise;
}
