/** True when WebGL cannot be created (happy-dom / jsdom unit runs). */
export function canCreateWebGLContext(): boolean {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}

/** True in headless DOM environments where map WebGL tests should skip. */
export function isHeadlessDomTestEnv(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    (navigator.userAgent.includes('jsdom') ||
      navigator.userAgent.includes('Happy DOM') ||
      navigator.userAgent.includes('happy-dom') ||
      typeof WebGLRenderingContext === 'undefined' ||
      !canCreateWebGLContext())
  );
}
