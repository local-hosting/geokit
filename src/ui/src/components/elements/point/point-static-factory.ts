/**
 * gk-point with crosswalk-backed accessors (DMA, shared point-layer features).
 */

import { PointAccessorsApi } from './point-accessors-api';
import { installPointFactoryStatics, type PointOptions } from './point-factory-static';

export type { PointOptions };

export class PointElement extends PointAccessorsApi {}

installPointFactoryStatics(PointElement);

if (!customElements.get('gk-point')) {
  customElements.define('gk-point', PointElement);
}