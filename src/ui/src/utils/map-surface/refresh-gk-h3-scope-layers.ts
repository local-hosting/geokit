import { removeEphemeralGkH3LayersFromMap } from './remove-ephemeral-gk-h3-map-layers';

type GkH3RefreshTarget = HTMLElement & { refreshScopeLayers?: () => void };

type MapForPrune = Parameters<typeof removeEphemeralGkH3LayersFromMap>[0];

/**
 * Remove stale `gk-h3` MapLibre layers and ask connected `gk-h3` elements to repaint.
 */
export function refreshGkH3ScopeLayersInMapHost(
  mapHost: HTMLElement | null | undefined,
  map?: MapForPrune,
): void {
  if (map) removeEphemeralGkH3LayersFromMap(map);
  if (!mapHost) return;
  mapHost.querySelectorAll('gk-h3').forEach((node) => {
    (node as GkH3RefreshTarget).refreshScopeLayers?.();
  });
}