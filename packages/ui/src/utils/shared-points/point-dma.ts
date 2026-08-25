/** GeoJSON property keys for Nielsen DMA enrichment on point features. */
export const POINT_DMA_PROPERTY = 'dma';
export const POINT_DMA_REGION_PROPERTY = 'region';

export interface EnrichPointWithDmaOptions {
  dmaKey?: string;
  regionKey?: string;
}
