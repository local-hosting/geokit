import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../../src/components/elements/map/map';

type TestMapElement = HTMLElement & {
  map: unknown;
  freeze: () => Promise<void>;
  unfreeze: () => Promise<boolean>;
  initializeMap: () => Promise<void>;
};

function createPoolManagedMap(): TestMapElement {
  const el = document.createElement('gk-map') as TestMapElement;
  el.setAttribute('data-pool-managed', 'true');
  document.body.appendChild(el);
  return el;
}

describe('gk-map detach grace window', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('keeps the map when re-attached within the grace window', () => {
    vi.useFakeTimers();
    const el = createPoolManagedMap();
    el.map = { remove: vi.fn() };
    const freeze = vi.spyOn(el, 'freeze').mockResolvedValue(undefined);

    el.remove();
    vi.advanceTimersByTime(100);
    document.body.appendChild(el);
    vi.advanceTimersByTime(1000);

    expect(freeze).not.toHaveBeenCalled();
  });

  it('freezes the map once it stays detached past the grace window', () => {
    vi.useFakeTimers();
    const el = createPoolManagedMap();
    el.map = { remove: vi.fn() };
    const freeze = vi.spyOn(el, 'freeze').mockResolvedValue(undefined);

    el.remove();
    vi.advanceTimersByTime(1000);

    expect(freeze).toHaveBeenCalledOnce();
  });

  it('frees a detached map immediately when a replacement with the same id connects', () => {
    vi.useFakeTimers();
    const previous = createPoolManagedMap();
    previous.id = 'hero-map';
    previous.map = { remove: vi.fn() };
    const freeze = vi.spyOn(previous, 'freeze').mockResolvedValue(undefined);

    previous.remove();
    const replacement = document.createElement('gk-map');
    replacement.id = 'hero-map';
    replacement.setAttribute('data-pool-managed', 'true');
    document.body.appendChild(replacement);

    expect(freeze).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1000);
    expect(freeze).toHaveBeenCalledOnce();
  });

  it('leaves detached maps with a different id inside their grace window', () => {
    vi.useFakeTimers();
    const previous = createPoolManagedMap();
    previous.id = 'hero-map';
    previous.map = { remove: vi.fn() };
    const freeze = vi.spyOn(previous, 'freeze').mockResolvedValue(undefined);

    previous.remove();
    const other = document.createElement('gk-map');
    other.id = 'side-map';
    other.setAttribute('data-pool-managed', 'true');
    document.body.appendChild(other);

    expect(freeze).not.toHaveBeenCalled();
  });
});

describe('gk-map freeze/unfreeze ordering', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shares one in-flight freeze across concurrent callers', async () => {
    const el = createPoolManagedMap();
    const remove = vi.fn();
    el.map = { remove };

    const first = el.freeze();
    const second = el.freeze();
    await Promise.all([first, second]);

    expect(first).toBe(second);
    expect(remove).toHaveBeenCalledOnce();
  });

  it('marks pool slot frozen when freeze runs without a map instance', async () => {
    const el = createPoolManagedMap() as TestMapElement & { _isFrozen?: boolean };
    await el.freeze();
    expect(el._isFrozen).toBe(true);
  });

  it('waits for an in-flight freeze before re-initializing', async () => {
    const el = createPoolManagedMap();
    const remove = vi.fn();
    el.map = { remove };
    const initializeMap = vi.fn(async () => {
      expect(remove).toHaveBeenCalledOnce();
      expect(el.map).toBeNull();
    });
    el.initializeMap = initializeMap;
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ width: 400, height: 300 } as DOMRect);

    const freezing = el.freeze();
    const restored = el.unfreeze();
    await freezing;
    await restored;

    expect(initializeMap).toHaveBeenCalledOnce();
  });
});
