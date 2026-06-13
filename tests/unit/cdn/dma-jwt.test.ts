import { describe, expect, it } from 'vitest';
import { validateDmaCdnJwt, validateIdentityJwt } from '../../../src/cdn/jwt';

function fakeJwt(payload: Record<string, unknown>): string {
  const enc = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${enc({ alg: 'HS256' })}.${enc({
    sub: 'did:key:z6Mktest',
    exp: Math.floor(Date.now() / 1000) + 7200,
    ...payload,
  })}.sig`;
}

describe('geokit/cdn jwt', () => {
  it('validateIdentityJwt accepts token with dma claim', () => {
    expect(validateIdentityJwt(fakeJwt({ dma: 'louisville' })).ok).toBe(true);
  });

  it('validateIdentityJwt rejects token without dma claim', () => {
    expect(validateIdentityJwt(fakeJwt({ tenant: 'dev' })).ok).toBe(false);
  });

  it('validateDmaCdnJwt matches entitled market slug', () => {
    const jwt = fakeJwt({ dma: 'louisville' });
    expect(validateDmaCdnJwt(jwt, 'louisville').ok).toBe(true);
    expect(validateDmaCdnJwt(jwt, 'chicago').ok).toBe(false);
  });
});
