/**
 * Popup CSS styles (Single Responsibility: inject and provide popup styles)
 */

const STYLE_ID = 'geokit-popup-styles';

export function getPopupStylesCss(): string {
  return `
  /* Geokit Popup Styles - Theme-aware via CSS variables */
  /* Variables are set by gk-map theme system, with dark theme defaults */
  
  /* CRITICAL: Fix canvas container position (MapLibre sometimes offsets it) */
  .maplibregl-canvas-container {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
  }
  
  /* Ensure popup is above canvas */
  .maplibregl-popup {
    z-index: 10;
  }
  
  /* Fade-out animation */
  .maplibregl-popup {
    transition: opacity 0.3s ease-out;
  }
  
  .maplibregl-popup.geokit-popup-fading {
    opacity: 0;
  }

  /* Popup background and text - uses CSS variables with dark theme defaults */
  .maplibregl-popup-content,
  .mapboxgl-popup-content {
    background: var(--gk-popup-background, rgb(22, 27, 34)) !important;
    color: var(--gk-popup-text, #c9d1d9) !important;
    position: relative;
    padding: 12px 14px;
    border-radius: 6px;
    min-width: 280px;
    max-width: 400px;
    overflow-wrap: break-word;
    word-wrap: break-word;
  }

  /* Popup tip color - match background for all anchor positions */
  .maplibregl-popup-anchor-bottom .maplibregl-popup-tip,
  .mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip {
    border-top-color: var(--gk-popup-background, rgb(22, 27, 34)) !important;
  }

  .maplibregl-popup-anchor-top .maplibregl-popup-tip,
  .mapboxgl-popup-anchor-top .mapboxgl-popup-tip {
    border-bottom-color: var(--gk-popup-background, rgb(22, 27, 34)) !important;
  }

  .maplibregl-popup-anchor-left .maplibregl-popup-tip,
  .mapboxgl-popup-anchor-left .mapboxgl-popup-tip {
    border-right-color: var(--gk-popup-background, rgb(22, 27, 34)) !important;
  }

  .maplibregl-popup-anchor-right .maplibregl-popup-tip,
  .mapboxgl-popup-anchor-right .mapboxgl-popup-tip {
    border-left-color: var(--gk-popup-background, rgb(22, 27, 34)) !important;
  }

  .maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip,
  .maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip,
  .mapboxgl-popup-anchor-bottom-left .mapboxgl-popup-tip,
  .mapboxgl-popup-anchor-bottom-right .mapboxgl-popup-tip {
    border-top-color: var(--gk-popup-background, rgb(22, 27, 34)) !important;
  }

  .maplibregl-popup-anchor-top-left .maplibregl-popup-tip,
  .maplibregl-popup-anchor-top-right .maplibregl-popup-tip,
  .mapboxgl-popup-anchor-top-left .mapboxgl-popup-tip,
  .mapboxgl-popup-anchor-top-right .mapboxgl-popup-tip {
    border-bottom-color: var(--gk-popup-background, rgb(22, 27, 34)) !important;
  }

  /* Close button styling */
  .maplibregl-popup-close-button,
  .mapboxgl-popup-close-button {
    position: absolute;
    top: 4px;
    right: 4px;
    padding: 4px 8px;
    font-size: 18px;
    line-height: 1;
    color: var(--gk-popup-close-button, #8b949e);
    background: transparent;
    border: none;
    cursor: pointer;
    z-index: 1;
  }

  .maplibregl-popup-close-button:hover,
  .mapboxgl-popup-close-button:hover {
    color: var(--gk-popup-text, #c9d1d9);
    background: var(--gk-popup-tag-background, rgba(139, 148, 158, 0.15));
    border-radius: 4px;
  }

  /* Utility classes for structured content */
  .geokit-popup-content {
    display: block;
    min-width: 60px;
    max-width: 100%;
    width: 100%;
    box-sizing: border-box;
    overflow-wrap: break-word;
    word-wrap: break-word;
    overflow: hidden;
  }
  
  h4.geokit-popup-title {
    margin: 0 0 2px 0;
    padding-right: 24px;
    font-weight: 700;
    color: var(--gk-popup-text, #c9d1d9);
    font-size: 12px;
    line-height: 1.4;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .geokit-popup-title-text {
    min-width: 0;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .geokit-popup-title-badges {
    flex-shrink: 0;
  }

  .geokit-popup-title-badges > .geokit-popup-badge:first-of-type {
    margin-left: 0;
  }

  .geokit-popup-badge {
    display: inline;
    margin-left: 6px;
    background: var(--gk-popup-link-color, #58a6ff);
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    border-radius: 3px;
    padding: 1px 5px;
    vertical-align: middle;
  }

  h5.geokit-popup-address {
    margin: 0 0 8px 0;
    font-size: 10px;
    font-weight: 400;
    color: var(--gk-popup-text-muted, #8b949e) !important;
    line-height: 1.4;
    display: block;
  }

  .geokit-popup-tags {
    margin-top: 14px;
    margin-bottom: 2px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .geokit-popup-tag {
    display: inline-flex;
    align-items: center;
    background: var(--gk-popup-tag-background, rgba(139, 148, 158, 0.15));
    color: var(--gk-popup-tag-text, #c9d1d9);
    font-size: 13px;
    border-radius: 5px;
    padding: 5px 12px;
    gap: 0;
    overflow: hidden;
  }

  /* Two-part pill: label has lighter bg, value has normal bg */
  .geokit-popup-tag:has(.geokit-popup-tag-label) {
    padding: 0;
    gap: 0;
  }

  .geokit-popup-tag-label {
    color: var(--gk-popup-text-muted, #6e7681);
    font-weight: 500;
    background: var(--gk-popup-tag-label-background, rgba(139, 148, 158, 0.08));
    padding: 5px 10px;
    border-radius: 5px 0 0 5px;
  }

  .geokit-popup-tag-value {
    background: var(--gk-popup-tag-background, rgba(139, 148, 158, 0.15));
    padding: 5px 10px;
    border-radius: 0 5px 5px 0;
  }

  .geokit-popup-actions {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--gk-popup-border, rgba(139, 148, 158, 0.2));
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .geokit-popup-actions-spacer {
    flex: 1;
  }

  .geokit-popup-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    text-decoration: none;
    transition: all 0.15s ease;
    color: var(--gk-popup-text-muted, #8b949e);
  }

  /* Icon button style (when SVG is provided) */
  .geokit-popup-action--icon {
    width: 28px;
    height: 28px;
    padding: 0;
  }

  .geokit-popup-action--icon:hover {
    background-color: var(--gk-popup-tag-background, rgba(139, 148, 158, 0.15));
  }

  .geokit-popup-action svg {
    width: 16px;
    height: 16px;
  }

  /* Text link style (fallback when no SVG) */
  .geokit-popup-action--text {
    color: var(--gk-popup-link-color, #58a6ff);
    font-size: 12px;
    padding: 4px 8px;
  }

  .geokit-popup-action--text:hover {
    filter: brightness(1.2);
    text-decoration: underline;
  }

  .geokit-popup-footer-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--gk-popup-text-muted, #6e7681);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  
  .geokit-popup-footer-label svg {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
  }

  /* Hover popup: lightweight preview that doesn't block clicks on the map */
  .geokit-popup-hover .maplibregl-popup-content,
  .geokit-popup-hover .mapboxgl-popup-content {
    pointer-events: none;
    min-width: 100px;
    padding: 8px 12px;
  }
`;
}

let stylesInjected = false;

/**
 * Inject styled popup CSS into document head (idempotent).
 * Returns true if styles were already injected or successfully injected.
 */
export function injectPopupStyles(): boolean {
  if (stylesInjected) return true;
  if (typeof document === 'undefined') return false;

  const existingStyle = document.getElementById(STYLE_ID);
  if (existingStyle) existingStyle.remove();

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = getPopupStylesCss().trim();
  document.head.appendChild(style);
  stylesInjected = true;
  return true;
}
