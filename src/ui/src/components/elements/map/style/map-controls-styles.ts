/**
 * Map control CSS injection (Single Responsibility: hide attribution, auto-hide controls)
 */

const HIDE_ATTRIBUTION_STYLE_ID = 'gk-hide-attribution-style';
const AUTO_HIDE_STYLE_ID = 'gk-auto-hide-controls-style';

/** True when MapLibre corner control layout rules are present (Vite-injected CSS has no href). */
export function isMaplibreLayoutCssLoaded(): boolean {
  if (typeof document === 'undefined') return false;
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        const selector = (rule as CSSStyleRule).selectorText;
        if (selector?.includes('.maplibregl-ctrl-top-right')) return true;
      }
    } catch {
      // Cross-origin stylesheets
    }
  }
  return false;
}

export function injectHideAttributionStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(HIDE_ATTRIBUTION_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = HIDE_ATTRIBUTION_STYLE_ID;
  style.textContent = `
    .gk-hide-attribution .maplibregl-ctrl-attrib,
    .gk-hide-attribution .mapboxgl-ctrl-attrib,
    .gk-hide-attribution .maplibregl-ctrl-attrib-button,
    .gk-hide-attribution .mapboxgl-ctrl-attrib-button,
    .gk-hide-attribution .maplibregl-ctrl-attrib-inner,
    .gk-hide-attribution .mapboxgl-ctrl-attrib-inner,
    .gk-hide-attribution .maplibregl-ctrl-logo,
    .gk-hide-attribution .mapboxgl-ctrl-logo,
    .gk-hide-attribution .maptiler-ctrl-logo,
    .gk-hide-attribution .maplibregl-compact,
    .gk-hide-attribution .mapboxgl-compact,
    .gk-hide-attribution .maplibregl-compact-show,
    .gk-hide-attribution .mapboxgl-compact-show,
    .gk-hide-attribution a[href*="maptiler"],
    .gk-hide-attribution a[href*="mapbox"],
    .gk-hide-attribution a[href*="protomaps"],
    .gk-hide-attribution a[href*="maplibre"],
    .gk-hide-attribution a[href*="openstreetmap"] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);
}

export function injectAutoHideStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(AUTO_HIDE_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = AUTO_HIDE_STYLE_ID;
  style.textContent = `
    gk-map.gk-controls-hidden .maplibregl-ctrl-group,
    gk-map.gk-controls-hidden .mapboxgl-ctrl-group,
    gk-map.gk-controls-hidden .maplibregl-ctrl,
    gk-map.gk-controls-hidden .mapboxgl-ctrl,
    gk-map.gk-controls-hidden [class*="maplibregl-ctrl"],
    gk-map.gk-controls-hidden [class*="mapboxgl-ctrl"],
    .gk-controls-hidden .maplibregl-ctrl-group,
    .gk-controls-hidden .mapboxgl-ctrl-group,
    .gk-controls-hidden .maplibregl-ctrl,
    .gk-controls-hidden .mapboxgl-ctrl {
      opacity: 0 !important;
      pointer-events: none !important;
      transition: opacity 0.2s ease-in-out !important;
    }
    gk-map:not(.gk-controls-hidden) .maplibregl-ctrl-group,
    gk-map:not(.gk-controls-hidden) .mapboxgl-ctrl-group,
    gk-map:not(.gk-controls-hidden) .maplibregl-ctrl,
    gk-map:not(.gk-controls-hidden) .mapboxgl-ctrl,
    gk-map:not(.gk-controls-hidden) [class*="maplibregl-ctrl"],
    gk-map:not(.gk-controls-hidden) [class*="mapboxgl-ctrl"] {
      opacity: 1 !important;
      pointer-events: auto !important;
      transition: opacity 0.2s ease-in-out;
    }
  `;
  document.head.appendChild(style);
}
