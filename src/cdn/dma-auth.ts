/**
 * Mint HS256 Globe CDN identity JWTs for local dev and demo servers.
 * Edge verifies signature; geokit only signs when GLOBE_CDN_JWT_SECRET is set.
 */

export type MintGlobeCdnIdentityJwtOptions = {
  sub: string;
  tenant?: string;
  /** When omitted, grants full CDN access (`dma: true`). */
  dma?: string | true;
};

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64url');
  }
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signHs256(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerPart = base64UrlEncode(JSON.stringify(header));
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerPart}.${payloadPart}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${base64UrlEncode(new Uint8Array(sig))}`;
}

/** Mint a bearer token for authenticated Globe CDN fetches. */
export async function mintGlobeCdnIdentityJwt(
  secret: string,
  options: MintGlobeCdnIdentityJwtOptions
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    sub: options.sub,
    exp: now + 12 * 60 * 60,
    dma: options.dma ?? true,
  };
  if (options.tenant) payload.tenant = options.tenant;
  return signHs256(payload, secret);
}
