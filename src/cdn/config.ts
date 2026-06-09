const DEFAULT_GLOBE_CDN_URL = 'https://mapto.link';

function envGlobeCdnUrl(): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    const fromProcess =
      process.env.GEOKIT_GLOBE_CDN_URL?.trim() ||
      process.env.GLOBE_CDN_URL?.trim() ||
      process.env.FW_GLOBE_CDN_URL?.trim();
    if (fromProcess !== undefined) return fromProcess.replace(/\/$/, '');
  }

  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const meta = import.meta.env as Record<string, string | undefined>;
    const fromMeta = meta.GEOKIT_GLOBE_CDN_URL?.trim() || meta.GLOBE_CDN_URL?.trim();
    if (fromMeta !== undefined) return fromMeta.replace(/\/$/, '');
  }

  return undefined;
}

export function resolveGlobeCdnBaseUrl(baseUrl?: string): string {
  const fromArg = baseUrl?.trim();
  if (fromArg !== undefined) return fromArg.replace(/\/$/, '');

  const fromEnv = envGlobeCdnUrl();
  if (fromEnv !== undefined) return fromEnv;

  return DEFAULT_GLOBE_CDN_URL;
}
