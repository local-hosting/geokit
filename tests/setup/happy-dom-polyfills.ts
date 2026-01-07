/**
 * Happy-DOM Polyfills for MapTiler SDK and MapLibre GL
 *
 * Happy-DOM has better Custom Elements support than JSDOM, but still needs
 * WebGL polyfills for map testing.
 */

/**
 * Create a comprehensive WebGL mock using Proxy.
 * Returns no-op functions for any method called, avoiding whack-a-mole with MapLibre internals.
 */
function createWebGLMock(canvas: HTMLCanvasElement): any {
  const mockContext = {
    canvas,
    drawingBufferWidth: 300,
    drawingBufferHeight: 150,
  };

  return new Proxy(mockContext, {
    get(target, prop) {
      // Return actual values for known properties
      if (prop in target) {
        return (target as any)[prop];
      }
      // Return common values for specific getters
      if (prop === 'getParameter') return () => null;
      if (prop === 'getExtension') return () => null;
      if (prop === 'getSupportedExtensions') return () => [];
      if (prop === 'getShaderParameter') return () => true;
      if (prop === 'getProgramParameter') return () => true;
      if (prop === 'checkFramebufferStatus') return () => 36053; // FRAMEBUFFER_COMPLETE
      if (prop === 'getContextAttributes') return () => ({});
      if (prop === 'isContextLost') return () => false;
      // For create* methods, return empty objects
      if (typeof prop === 'string' && prop.startsWith('create')) return () => ({});
      // Everything else is a no-op function
      return () => {};
    },
  });
}

// Polyfill WebGL context if not available
if (typeof window !== 'undefined' && typeof HTMLCanvasElement !== 'undefined') {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.getContext = function (
    contextId: string,
    _options?: any
  ): RenderingContext | null {
    if (contextId === 'webgl' || contextId === 'webgl2' || contextId === 'experimental-webgl') {
      return createWebGLMock(this);
    }
    // Fall back to original for other context types
    return originalGetContext?.call(this, contextId, _options) ?? null;
  };
}

// Polyfill Worker if not available (required by MapLibre GL)
if (typeof window !== 'undefined' && typeof Worker === 'undefined') {
  (globalThis as any).Worker = class Worker {
    constructor(_scriptURL: string | URL, _options?: WorkerOptions) {
      // Mock worker - doesn't actually do anything
    }
    postMessage(_message: any): void {
      // No-op
    }
    terminate(): void {
      // No-op
    }
    addEventListener(_type: string, _listener: EventListenerOrEventListenerObject): void {
      // No-op
    }
    removeEventListener(_type: string, _listener: EventListenerOrEventListenerObject): void {
      // No-op
    }
  };
}

// Polyfill ResizeObserver if not available
if (typeof window !== 'undefined' && typeof ResizeObserver === 'undefined') {
  (globalThis as any).ResizeObserver = class ResizeObserver {
    constructor(_callback: ResizeObserverCallback) {}
    observe(_target: Element): void {}
    unobserve(_target: Element): void {}
    disconnect(): void {}
  };
}

// Polyfill requestAnimationFrame if not available
if (typeof window !== 'undefined' && typeof requestAnimationFrame === 'undefined') {
  (globalThis as any).requestAnimationFrame = function (callback: FrameRequestCallback): number {
    return setTimeout(() => callback(Date.now()), 16) as unknown as number;
  };
}

if (typeof window !== 'undefined' && typeof cancelAnimationFrame === 'undefined') {
  (globalThis as any).cancelAnimationFrame = function (handle: number): void {
    clearTimeout(handle);
  };
}

// Polyfill ImageData if not available (required by MapLibre GL)
if (typeof window !== 'undefined' && typeof ImageData === 'undefined') {
  (globalThis as any).ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
      this.data = new Uint8ClampedArray(width * height * 4);
    }
  };
}

// Suppress known MapLibre warnings in test environment
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const message = args[0];
  if (
    typeof message === 'string' &&
    (message.includes('Failed to load MapTiler SDK') ||
      message.includes('URL.createObjectURL') ||
      message.includes('WebGL') ||
      message.includes('Worker is not defined') ||
      message.includes('No actors found') ||
      message.includes('Error while setting style') ||
      message.includes('ImageData is not defined'))
  ) {
    return;
  }
  originalConsoleError(...args);
};

// Suppress unhandled promise rejections from MapTiler SDK telemetry and MapLibre GL
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string' &&
      (error.message.includes('getProjection') ||
        error.message.includes('Cannot read properties of undefined') ||
        error.message.includes('ImageData is not defined'))
    ) {
      // Suppress MapTiler SDK telemetry errors and MapLibre GL errors in test environment
      event.preventDefault();
    }
  });
}

