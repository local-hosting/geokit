import { afterEach, describe, expect, it } from 'vitest';

import { isUpgradedMapCollectionAncestor } from '../../../src/components/elements/map/is-upgraded-map-collection';

describe('isUpgradedMapCollectionAncestor', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('is false when there is no gk-map-collection ancestor', () => {
    const map = document.createElement('div');
    document.body.appendChild(map);
    expect(isUpgradedMapCollectionAncestor(map)).toBe(false);
  });

  it('is false when the collection CE ctor is missing (unupgraded tag)', () => {
    const wrap = document.createElement('gk-map-collection');
    const map = document.createElement('div');
    wrap.appendChild(map);
    document.body.appendChild(wrap);
    expect(isUpgradedMapCollectionAncestor(map, () => undefined)).toBe(false);
  });

  it('is true when the ancestor is an instance of the registered collection ctor', () => {
    class StubCollection extends HTMLElement {}
    const tag = `gk-map-collection-stub-${Math.random().toString(36).slice(2)}`;
    customElements.define(tag, StubCollection);
    const host = document.createElement(tag);
    const map = document.createElement('div');
    host.appendChild(map);
    document.body.appendChild(host);
    // Simulate closest('gk-map-collection') by stubbing on the map element
    map.closest = ((selector: string) =>
      selector === 'gk-map-collection' ? host : null) as typeof map.closest;
    expect(isUpgradedMapCollectionAncestor(map, () => StubCollection)).toBe(true);
  });
});
