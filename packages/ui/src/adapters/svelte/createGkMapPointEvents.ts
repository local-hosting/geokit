import type { GkPointEventHandlers } from '../../utils/map-events';
import { bindGkMapPointEventsLifecycle } from '../shared/point-events-lifecycle';

/** Lifecycle-aware gk-point-* binding; teardown from onDestroy. */
export function createGkMapPointEvents(
  getContainer: () => HTMLElement | null,
  handlers: GkPointEventHandlers
): () => void {
  return bindGkMapPointEventsLifecycle(getContainer(), handlers);
}
