/** Paint and geometry attrs for geokit map children (gk-h3, gk-isochrone, …). */
export type GkMapChildAttributeValue = string | number | boolean;

/**
 * Apply observed attributes on a map child CE.
 * Vue often binds paint keys as DOM properties — use this after `ref` mount.
 */
export function syncGkMapChildAttributes(
  element: Element | null | undefined,
  attrs: Record<string, GkMapChildAttributeValue | null | undefined>,
): void {
  if (!element) return;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) {
      element.removeAttribute(key);
      continue;
    }
    element.setAttribute(key, String(value));
  }
}

/** Default non-interactive project-scope hex overlays (omit `interactive` attribute). */
export function clearGkMapChildInteractiveAttribute(element: Element | null | undefined): void {
  element?.removeAttribute('interactive');
}

export type GkH3PaintAttributes = {
  color: string;
  opacity: number;
  strokeColor: string;
  strokeWidth: number;
};

/** Vue does not reliably pass `color` / `opacity` to the `gk-h3` custom element. */
export function syncGkH3PaintAttributes(
  element: Element | null | undefined,
  paint: GkH3PaintAttributes,
): void {
  syncGkMapChildAttributes(element, {
    color: paint.color,
    opacity: paint.opacity,
    'stroke-color': paint.strokeColor,
    'stroke-width': paint.strokeWidth,
  });
}