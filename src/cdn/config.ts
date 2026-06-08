const DEFAULT_GLOBE_CDN_URL = 'https://mapto.link';

export function resolveGlobeCdnBaseUrl(baseUrl?: string): string {
  const fromArg = baseUrl?.trim();
  if (fromArg) return fromArg.replace(/\/$/, '');

  if (typeof process !== 'undefined' && process.env) {
    const fromEnv =
      process.env.GEOKIT_GLOBE_CDN_URL?.trim() ||
      process.env.GLOBE_CDN_URL?.trim() ||
      process.env.FW_GLOBE_CDN_URL?.trim();
    if (fromEnv) return fromEnv.replace(/\/$/, '');
  }

  return DEFAULT_GLOBE_CDN_URL;
}
