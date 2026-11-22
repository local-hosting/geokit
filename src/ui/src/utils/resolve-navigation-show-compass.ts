/**
 * MapLibre's compass control adds non-passive `touchmove` on the window for drag-to-rotate.
 * Default the compass off on coarse pointers (touch) unless the host opts in explicitly.
 */
export function resolveNavigationShowCompass(
  attributePresent: boolean,
  attributeValue: boolean,
): boolean {
  if (attributePresent) return attributeValue;
  if (typeof globalThis.matchMedia !== 'function') return true;
  return globalThis.matchMedia('(pointer: fine)').matches;
}