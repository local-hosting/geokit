import { afterEach, describe, expect, it, vi } from 'vitest';
import * as mapFreeze from '../../../src/components/elements/map/lifecycle/map-freeze';
import '../../../src/components/elements/map/map';

type InitMapElement = HTMLElement & {
  initializeMap: () => Promise<void>;
};

describe('gk-map initializeMap coalescing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('does not let a overlapping caller finish before the in-flight init resolves', async () => {
    let releaseWait!: () => void;
    const waitGate = new Promise<void>((resolve) => {
      releaseWait = resolve;
    });

    vi.spyOn(mapFreeze, 'waitUntilCanCreateMap').mockImplementation(async () => {
      await waitGate;
      return false;
    });
    vi.spyOn(mapFreeze, 'delayForWebGLRelease').mockResolvedValue(undefined);

    const el = document.createElement('gk-map') as InitMapElement;
    el.setAttribute('provider', 'maptiler');
    el.setAttribute('api-key', 'test-key');
    el.setAttribute('lat', '40');
    el.setAttribute('lng', '-74');
    el.style.width = '320px';
    el.style.height = '200px';
    document.body.appendChild(el);

    const finished: string[] = [];
    const first = el.initializeMap().then(() => finished.push('first'));
    const second = el.initializeMap().then(() => finished.push('second'));

    await Promise.resolve();
    expect(finished).toEqual([]);

    releaseWait();
    await Promise.all([first, second]);

    expect(finished).toEqual(['first', 'second']);
  });
});