import { describe, expect, it, vi } from 'vitest';
import {
  isHarmlessWebglContextLostMessage,
  isMaptilerSdkBannerMessage,
  withSuppressedMaptilerConsole,
} from '../../../src/providers/maptiler-console-suppress';

describe('maptiler-console-suppress', () => {
  it('detects MapTiler SDK banner messages', () => {
    expect(isMaptilerSdkBannerMessage(['MapTiler SDK JS v3.10.2'])).toBe(true);
    expect(isMaptilerSdkBannerMessage(['%c❖%c❖%c❖ %cMapTiler SDK JS v3.10.2 %c❖%c❖%c❖'])).toBe(
      true
    );
    expect(isMaptilerSdkBannerMessage(['core.user.created'])).toBe(false);
  });

  it('detects harmless WebGL context-lost warnings after map removal', () => {
    expect(
      isHarmlessWebglContextLostMessage([
        '[webglcontextlost]',
        'WebGL context lost after map removal. This is harmless.',
      ])
    ).toBe(true);
    expect(isHarmlessWebglContextLostMessage(['Unexpected loss of WebGL context!'])).toBe(false);
  });

  it('suppresses harmless webglcontextlost warns during scoped run', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await withSuppressedMaptilerConsole(async () => {
      console.warn(
        '[webglcontextlost]',
        'WebGL context lost after map removal. This is harmless.'
      );
      console.warn('keep this warn');
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.join(' ')).toContain('keep this warn');
    warnSpy.mockRestore();
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
