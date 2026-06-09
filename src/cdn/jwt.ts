/**
 * Client-side Globe CDN JWT claim checks (decode only — edge verifies signature).
 */

export type CdnJwtValidation = {
  ok: boolean;
  payload?: Record<string, unknown>;
  reason?: string;
};

function normalizeGlobeCdnDmaSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token
    .trim()
    .replace(/^Bearer\s+/i, '')
    .split('.');
  if (parts.length !== 3) return null;
  try {
    const segment = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const padded = segment.padEnd(segment.length + ((4 - (segment.length % 4)) % 4), '=');
    const json =
      typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasDmaAccess(payload: Record<string, unknown>): boolean {
  if (payload.dma === true) return true;
  if (typeof payload.dma === 'string') {
    return Boolean(normalizeGlobeCdnDmaSlug(payload.dma));
  }
  return false;
}

function readDmaClaim(payload: Record<string, unknown>): string | null {
  if (payload.dma === true) return null;
  if (typeof payload.dma !== 'string') return null;
  const dma = normalizeGlobeCdnDmaSlug(payload.dma);
  return dma || null;
}

export function validateIdentityJwt(jwt: string): CdnJwtValidation {
  const token = jwt.trim().replace(/^Bearer\s+/i, '');
  if (!token) {
    return { ok: false, reason: 'empty token' };
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    return { ok: false, reason: 'decode failed' };
  }

  if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
    return { ok: false, reason: 'expired', payload };
  }
  if (!payload.sub && !payload.iss) {
    return { ok: false, reason: 'missing subject', payload };
  }
  if (!hasDmaAccess(payload)) {
    return { ok: false, reason: 'missing dma claim', payload };
  }
  return { ok: true, payload };
}

/** Validate identity + dma claim; optional market slug must match claim. */
export function validateDmaCdnJwt(jwt: string, marketSlug?: string): CdnJwtValidation {
  const base = validateIdentityJwt(jwt);
  if (!base.ok || !base.payload) return base;

  const dma = readDmaClaim(base.payload);
  if (!dma) {
    if (base.payload.dma === true) return base;
    return { ok: false, reason: 'missing dma claim', payload: base.payload };
  }
  if (marketSlug) {
    const requested = normalizeGlobeCdnDmaSlug(marketSlug);
    if (requested !== dma) {
      return { ok: false, reason: 'dma claim mismatch', payload: base.payload };
    }
  }
  return base;
}
