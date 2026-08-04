const MAPTILER_BANNER_PATTERN = /maptiler\s+sdk\s+js|❖.*❖.*❖/i;
const MAPTILER_API_KEY_WARNING = 'MapTiler Cloud API key is not set';

export function isMaptilerSdkBannerMessage(args: unknown[]): boolean {
  try {
    const msg = args.map((x) => String(x)).join(' ');
    return MAPTILER_BANNER_PATTERN.test(msg);
  } catch {
    return false;
  }
}

type ConsoleMethod = 'log' | 'info' | 'warn';

/** Scoped console filter during MapTiler SDK load — restores natives so other loggers keep correct attribution. */
export async function withSuppressedMaptilerConsole<T>(
  run: () => T | Promise<T>,
  options?: { suppressApiKeyWarning?: boolean }
): Promise<T> {
  const originals = {
    log: console.log,
    info: console.info,
    warn: console.warn,
  };

  const wrap = (original: typeof console.log, method: ConsoleMethod) => {
    return function (this: typeof console, ...args: unknown[]) {
      if (isMaptilerSdkBannerMessage(args)) return;
      if (
        options?.suppressApiKeyWarning &&
        method === 'warn' &&
        args
          .map((x) => String(x))
          .join(' ')
          .includes(MAPTILER_API_KEY_WARNING)
      ) {
        return;
      }
      original.apply(console, args);
    };
  };

  console.log = wrap(originals.log, 'log');
  console.info = wrap(originals.info, 'info');
  console.warn = wrap(originals.warn, 'warn');

  try {
    return await Promise.resolve(run());
  } finally {
    console.log = originals.log;
    console.info = originals.info;
    console.warn = originals.warn;
  }
}
