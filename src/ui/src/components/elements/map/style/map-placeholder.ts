/**
 * Map placeholder content (Single Responsibility: loading/restoring message DOM)
 */

/** One-shot timeout ms: fire gk-map-stuck if placeholder still visible after this. */
export const STUCK_PLACEHOLDER_MS = 10000;

const PLACEHOLDER_SELECTOR = '.map-placeholder, [data-map-placeholder="true"]';

/**
 * Create placeholder HTML with optional spinner (spinner left, text right).
 * Pure function; injects keyframes style once per document.
 */
export function createPlaceholderContent(text: string, showSpinner: boolean): string {
  if (!showSpinner) return text;

  // Fallbacks match theme.css light defaults (not dark) so first paint does not flash dark.
  const spinnerStyle = `
    display: inline-block;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border: 2px solid var(--gk-placeholder-text, #6b7280);
    border-top-color: transparent;
    border-radius: 50%;
    animation: gk-spin 0.8s linear infinite;
  `
    .replace(/\s+/g, ' ')
    .trim();

  if (typeof document !== 'undefined' && !document.getElementById('gk-spinner-keyframes')) {
    const style = document.createElement('style');
    style.id = 'gk-spinner-keyframes';
    style.textContent = '@keyframes gk-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }

  return `<span style="${spinnerStyle}"></span><span>${text}</span>`;
}

/** Inline style for the loading placeholder. Fallbacks are light (theme.css :root defaults). */
export const MAP_PLACEHOLDER_STYLE =
  'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: var(--gk-placeholder-background, #f5f5f5); color: var(--gk-placeholder-text, #6b7280); display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 0.75rem; font-size: 0.9rem; z-index: 1;';

export function getPlaceholderSelector(): string {
  return PLACEHOLDER_SELECTOR;
}
