import { describe, expect, it } from 'vitest';
import { shouldDeferH3PolygonBeforeTessellation } from '../../../src/components/elements/isochrone/isochrone-h3-display-policy';

describe('isochrone H3 display policy', () => {
  it('tessellates before map paint (no deferred polygon flash)', () => {
    expect(shouldDeferH3PolygonBeforeTessellation()).toBe(false);
  });
});