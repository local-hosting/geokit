import {
  datasetFillLayerId,
  stackGkOutlineLayersAboveDatasetFill,
  stackLayersAboveAnchor,
} from './layer-stack';
import type { SharedPointLayerIds } from '../paint/shared-point-paint';

type MapWithStyle = Parameters<typeof stackLayersAboveAnchor>[0];

type GkMapLike = HTMLElement & { getMap?: () => MapWithStyle };

export type BindGkVenueLayerStackingOptions = {
  venueMarketSlug?: string;
  dmaDataset?: string;
};

export function restackVenueLayersAboveDmaFill(
  map: MapWithStyle,
  ids: SharedPointLayerIds,
  dataset = 'dma'
): void {
  const fillLayerId = datasetFillLayerId(dataset);
  stackGkOutlineLayersAboveDatasetFill(map, fillLayerId);
  stackLayersAboveAnchor(map, [ids.glowLayerId, ids.pointLayerId], fillLayerId);
}

export function restackVenueLayersForMarket(
  map: MapWithStyle,
  marketSlug: string,
  dmaDataset = 'dma'
): void {
  restackVenueLayersAboveDmaFill(
    map,
    {
      sourceId: `venues-${marketSlug}`,
      glowLayerId: `${marketSlug}-venue-glow`,
      pointLayerId: `${marketSlug}-venue-points`,
    },
    dmaDataset
  );
}

/** Keep venue points above DMA fill; re-run on gk-layer-ready. */
export function bindGkVenueLayerStacking(
  gkMap: GkMapLike,
  options: BindGkVenueLayerStackingOptions = {}
): () => void {
  const marketSlug = options.venueMarketSlug ?? 'hero';
  const dmaDataset = options.dmaDataset ?? 'dma';

  const restack = (): void => {
    const map = gkMap.getMap?.();
    if (!map) return;
    restackVenueLayersForMarket(map, marketSlug, dmaDataset);
  };

  gkMap.addEventListener('gk-layer-ready', restack);
  restack();

  return () => gkMap.removeEventListener('gk-layer-ready', restack);
}
