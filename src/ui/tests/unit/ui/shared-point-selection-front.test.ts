import { describe, expect, it } from 'vitest';

import { sharedPointSelectionFrontLayerIds } from '../../../src/utils/markers/marker-shape';
import { raiseSharedPointBadgeIconLayersOnTop } from '../../../src/utils/paint/shared-point-badge-icon';

const p = 'canvas-places-point';

/** Live order seen in the app: resting rounded stack drawn over the selected badge. */
const LIVE_ORDER = [
  'canvas-places-glow',
  `${p}-glass`,
  `${p}-outer-stroke`,
  `${p}-selection-shadow`,
  `${p}-hover-badge-outer`,
  `${p}-hover-badge`,
  p,
  `${p}-selection-rounded-shadow`,
  `${p}-selection-rounded-outer`,
  `${p}-selection-rounded-ring`,
  `${p}-selection-rounded-body`,
  `${p}-selection-badge-outer`,
  `${p}-selection-badge`,
  `${p}-rounded-shadow`,
  `${p}-rounded-outer`,
  `${p}-rounded-ring`,
  `${p}-rounded-body`,
  `${p}-badge-icon`,
  `${p}-selection-badge-icon`,
  `${p}-selection-ring`,
];

function orderedMap(initial: string[]) {
  const order = [...initial];
  return {
    order,
    getLayer: (id: string) => (order.includes(id) ? { id } : undefined),
    moveLayer: (id: string, beforeId?: string) => {
      order.splice(order.indexOf(id), 1);
      if (beforeId && order.includes(beforeId)) order.splice(order.indexOf(beforeId), 0, id);
      else order.push(id);
    },
  };
}

describe('selected marker draws in front', () => {
  it('raises every selected layer above every resting marker layer, keeping its own order', () => {
    const map = orderedMap(LIVE_ORDER);
    raiseSharedPointBadgeIconLayersOnTop(map as never, p);

    const front = sharedPointSelectionFrontLayerIds(p);
    const firstFront = Math.min(...front.map((id) => map.order.indexOf(id)));
    const resting = map.order.filter((id) => !front.includes(id));
    for (const id of resting) expect(map.order.indexOf(id)).toBeLessThan(firstFront);
    expect(map.order.slice(-front.length)).toEqual(front);
  });

  it('raises the lifted badge only — ground shadows stay under the ring', () => {
    expect(sharedPointSelectionFrontLayerIds(p)).toEqual([
      `${p}-selection-badge-outer`,
      `${p}-selection-badge`,
      `${p}-selection-rounded-outer`,
      `${p}-selection-rounded-ring`,
      `${p}-selection-rounded-body`,
      `${p}-selection-badge-icon`,
    ]);
    expect(sharedPointSelectionFrontLayerIds(p)).not.toContain(`${p}-selection-shadow`);
    expect(sharedPointSelectionFrontLayerIds(p)).not.toContain(
      `${p}-selection-rounded-shadow`
    );
  });
});
