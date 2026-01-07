/**
 * JSDOM Polyfills for MapTiler SDK and MapLibre GL
 *
 * Provides necessary polyfills for running map-related tests in jsdom environment
 */

// Polyfill URL.createObjectURL and revokeObjectURL
if (typeof globalThis !== 'undefined' && typeof URL !== 'undefined') {
  if (!URL.createObjectURL) {
    URL.createObjectURL = function (_blob: Blob | MediaSource): string {
      // Return a fake URL for testing purposes
      return `blob:${Math.random().toString(36).substr(2, 9)}`;
    };
  }

  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = function (_url: string): void {
      // No-op for testing
    };
  }
}

// Also polyfill on window if available
if (typeof window !== 'undefined' && typeof window.URL !== 'undefined') {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = function (_blob: Blob | MediaSource): string {
      return `blob:${Math.random().toString(36).substr(2, 9)}`;
    };
  }

  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = function (_url: string): void {
      // No-op
    };
  }
}

// Polyfill Worker if not available
if (typeof window !== 'undefined' && typeof Worker === 'undefined') {
  (global as any).Worker = class Worker {
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

// WebGL context polyfill is in happy-dom-polyfills.ts (uses cleaner Proxy approach)

// Polyfill ResizeObserver if not available
if (typeof window !== 'undefined' && typeof ResizeObserver === 'undefined') {
  (global as any).ResizeObserver = class ResizeObserver {
    constructor(_callback: ResizeObserverCallback) {
      // Mock ResizeObserver
    }
    observe(_target: Element): void {
      // No-op
    }
    unobserve(_target: Element): void {
      // No-op
    }
    disconnect(): void {
      // No-op
    }
  };
}

// Polyfill IntersectionObserver if not available
if (typeof window !== 'undefined' && typeof IntersectionObserver === 'undefined') {
  (global as any).IntersectionObserver = class IntersectionObserver {
    constructor(_callback: IntersectionObserverCallback) {
      // Mock IntersectionObserver
    }
    observe(_target: Element): void {
      // No-op
    }
    unobserve(_target: Element): void {
      // No-op
    }
    disconnect(): void {
      // No-op
    }
  };
}

// Polyfill requestAnimationFrame if not available
if (typeof window !== 'undefined' && typeof requestAnimationFrame === 'undefined') {
  (global as any).requestAnimationFrame = function (callback: FrameRequestCallback): number {
    return setTimeout(() => callback(Date.now()), 16) as unknown as number;
  };
}

// Polyfill cancelAnimationFrame if not available
if (typeof window !== 'undefined' && typeof cancelAnimationFrame === 'undefined') {
  (global as any).cancelAnimationFrame = function (handle: number): void {
    clearTimeout(handle);
  };
}

// Polyfill ImageData if not available
if (typeof window !== 'undefined' && typeof ImageData === 'undefined') {
  (global as any).ImageData = class ImageData {
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
      message.includes('WebGL'))
  ) {
    // Suppress these specific errors in tests
    return;
  }
  originalConsoleError(...args);
};

/**
 * Suppress JSDOM's NotSupportedError for custom element attributes.
 * 
 * JSDOM has incomplete Custom Elements v1 support. When setAttribute() is called
 * on a custom element, JSDOM throws "NotSupportedError: Unexpected attributes"
 * asynchronously (via internal mutation observers), bypassing try/catch blocks.
 * 
 * This is a JSDOM limitation - real browsers don't have this issue.
 * For tests that heavily use custom elements, use Happy-DOM instead:
 *   @vitest-environment happy-dom
 */
function isJsdomAttributeError(error: any): boolean {
  return (
    error?.name === 'NotSupportedError' ||
    error?.code === 9 ||
    (error?.message && error.message.includes('Unexpected attributes'))
  );
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (isJsdomAttributeError(event.error)) {
      event.preventDefault();
      event.stopPropagation();
      return true;
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isJsdomAttributeError(event.reason)) {
      event.preventDefault();
    }
  });
}
