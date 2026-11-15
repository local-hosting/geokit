/** Stop the style-load poll when the map instance was torn down or frozen mid-init. */
export function shouldSilenceStyleLoadPoll(options: {
  hasMap: boolean;
  isFrozen: boolean;
}): boolean {
  return !options.hasMap || options.isFrozen;
}