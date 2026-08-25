import type { Bounds } from '@geokit/core/types';

export const GK_FLY_TO_BOUNDS_EVENT = 'gk-fly-to-bounds';

export type GkFlyToBoundsDetail = {
  /** Target map/card id (e.g. market slug). Omit to broadcast. */
  sourceId?: string;
  bounds: Bounds;
  market?: string;
};

export function dispatchGkFlyToBounds(detail: GkFlyToBoundsDetail): void {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(
    new CustomEvent(GK_FLY_TO_BOUNDS_EVENT, {
      detail,
      bubbles: true,
    })
  );
}

/** Listen for fly-to requests scoped to a map container source id. */
export function bindGkFlyToBounds(
  sourceId: string | undefined,
  onFly: (detail: GkFlyToBoundsDetail) => void
): () => void {
  if (typeof document === 'undefined') return () => {};

  const handler = (event: Event): void => {
    const detail = (event as CustomEvent<GkFlyToBoundsDetail>).detail;
    if (!detail?.bounds) return;
    if (sourceId && detail.sourceId && detail.sourceId !== sourceId) return;
    onFly(detail);
  };

  document.addEventListener(GK_FLY_TO_BOUNDS_EVENT, handler as EventListener);
  return () => document.removeEventListener(GK_FLY_TO_BOUNDS_EVENT, handler as EventListener);
}
