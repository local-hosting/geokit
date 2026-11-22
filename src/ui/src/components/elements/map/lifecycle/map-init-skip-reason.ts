/** Init exited without a map but may succeed on a scheduled retry (WebGL / transient createMap). */
const RECOVERABLE_INIT_SKIP_REASONS = new Set([
  'disconnected-during-webgl-wait',
  'webgl-budget-full',
  'create-map-failed',
  'create-map-retry-failed',
  'create-map-null-instance',
]);

export function isRecoverableMapInitSkipReason(reason: string | null): boolean {
  if (!reason) return false;
  return RECOVERABLE_INIT_SKIP_REASONS.has(reason);
}