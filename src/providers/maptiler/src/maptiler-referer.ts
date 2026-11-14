/** Referer for MapTiler geocoding (key restriction). Prefer config, then page origin. */
export function resolveMaptilerRequestReferer(options?: {
  referer?: string;
  origin?: string;
}): string {
  const configured = options?.referer?.trim();
  if (configured) {
    return configured.endsWith('/') ? configured : `${configured}/`;
  }

  const origin =
    options?.origin?.trim() ||
    (typeof window !== 'undefined' ? window.location?.origin?.trim() : undefined);
  if (origin) {
    return origin.endsWith('/') ? origin : `${origin}/`;
  }

  return 'http://localhost/';
}
