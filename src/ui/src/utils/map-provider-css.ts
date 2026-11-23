/**
 * Provider CSS detection for Vite (injected `<style>` tags have no `href`).
 * Mapbox detects its own CSS via `.mapboxgl-canary { background-color: salmon }`.
 */

const MAPBOX_CSS_CANARY_RGB = 'rgb(250, 128, 114)';

/** Same probe Mapbox GL runs in `Map` — computed salmon on `.mapboxgl-canary`. */
export function isMapboxGlCssApplied(): boolean {
  if (typeof document === 'undefined') return false;
  const probe = document.createElement('div');
  probe.className = 'mapboxgl-canary';
  probe.style.visibility = 'hidden';
  probe.style.position = 'absolute';
  probe.style.pointerEvents = 'none';
  const host = document.body ?? document.head ?? document.documentElement;
  host.appendChild(probe);
  const applied =
    getComputedStyle(probe).getPropertyValue('background-color') === MAPBOX_CSS_CANARY_RGB;
  host.removeChild(probe);
  return applied;
}

/** True when Mapbox GL layout CSS is present (stylesheet rule or live canary). */
export function isMapboxGlCssLoaded(): boolean {
  if (isMapboxGlCssApplied()) return true;
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

/** Poll until Mapbox's canary probe passes (Vite may resolve CSS before styles apply). */
export function waitForMapboxGlCssApplied(timeoutMs = 3000): Promise<void> {
  if (isMapboxGlCssApplied()) return Promise.resolve();
  const deadline = performance.now() + timeoutMs;
  return new Promise((resolve) => {
    const tick = () => {
      if (isMapboxGlCssApplied() || performance.now() >= deadline) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

let mapboxCssImportPromise: Promise<void> | null = null;

/** Import mapbox-gl.css and wait until Mapbox would accept layout CSS as loaded. */
export async function ensureMapboxGlCss(): Promise<void> {
  if (isMapboxGlCssApplied()) return;
  if (!mapboxCssImportPromise) {
    mapboxCssImportPromise = (async () => {
      await import('mapbox-gl/dist/mapbox-gl.css');
      await waitForMapboxGlCssApplied();
    })();
  }
  await mapboxCssImportPromise;
}

/** MapLibre layout CSS (Protomaps / MapTiler stack) — idempotent under concurrent bootstrap. */
let maplibreCssPromise: Promise<void> | null = null;

export function ensureMaplibreGlCss(): Promise<void> {
  if (!maplibreCssPromise) {
    maplibreCssPromise = import('maplibre-gl/dist/maplibre-gl.css').then(() => undefined);
  }
  return maplibreCssPromise;
}
