import { describe, expect, it } from 'vitest';
import {
  isMaptilerSdkBannerMessage,
  withSuppressedMaptilerConsole,
} from '../../../src/providers/maptiler-console-suppress.js';

describe('maptiler-console-suppress', () => {
  it('detects MapTiler SDK banner messages', () => {
    expect(isMaptilerSdkBannerMessage(['MapTiler SDK JS v3.10.2'])).toBe(true);
    expect(isMaptilerSdkBannerMessage(['%c❖%c❖%c❖ %cMapTiler SDK JS v3.10.2 %c❖%c❖%c❖'])).toBe(
      true
    );
    expect(isMaptilerSdkBannerMessage(['core.user.created'])).toBe(false);
  });

  it('restores native console methods after scoped suppression', async () => {
    const beforeLog = console.log;
    const beforeInfo = console.info;
    const beforeWarn = console.warn;

    await withSuppressedMaptilerConsole(async () => {
      expect(console.log).not.toBe(beforeLog);
      expect(console.info).not.toBe(beforeInfo);
      expect(console.warn).not.toBe(beforeWarn);
    });

    expect(console.log).toBe(beforeLog);
    expect(console.info).toBe(beforeInfo);
    expect(console.warn).toBe(beforeWarn);
  });
});
