/**
 * gk-point without crosswalk-backed accessors (DMA / getFeatureData enrichment).
 * Used by elements-lite/register and other slim embeds.
 */

import { PointSelectRuntime } from './point-select-runtime';
import { installPointFactoryStatics, type PointOptions } from './point-factory-static';

export type { PointOptions };

export class PointVisualElement extends PointSelectRuntime {}

installPointFactoryStatics(PointVisualElement);

if (!customElements.get('gk-point')) {
  customElements.define('gk-point', PointVisualElement);
}