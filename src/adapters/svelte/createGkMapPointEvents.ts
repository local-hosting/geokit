import type { GkPointEventHandlers } from '../../ui/utils/map-events.js';
import { bindGkMapPointEventsLifecycle } from '../shared/point-events-lifecycle.js';

/** Lifecycle-aware gk-point-* binding; teardown from onDestroy. */
export function createGkMapPointEvents(
  getContainer: () => HTMLElement | null,
  handlers: GkPointEventHandlers
): () => void {
  return bindGkMapPointEventsLifecycle(getContainer(), handlers);
}
