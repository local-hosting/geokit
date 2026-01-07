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

// Polyfill WebGL context if not available
if (typeof window !== 'undefined' && typeof HTMLCanvasElement !== 'undefined') {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.getContext = function (
    contextId: string,
    options?: any
  ): RenderingContext | null {
    if (contextId === 'webgl' || contextId === 'webgl2' || contextId === 'experimental-webgl') {
      // Return a mock WebGL context for testing
      return {
        canvas: this,
        drawingBufferWidth: 300,
        drawingBufferHeight: 150,
        getParameter: () => null,
        getExtension: () => null,
        getSupportedExtensions: () => [],
        // Add minimal methods to prevent crashes
        viewport: () => {},
        clearColor: () => {},
        clear: () => {},
        createShader: () => ({}),
        shaderSource: () => {},
        compileShader: () => {},
        getShaderParameter: () => true,
        createProgram: () => ({}),
        attachShader: () => {},
        linkProgram: () => {},
        getProgramParameter: () => true,
        useProgram: () => {},
        createBuffer: () => ({}),
        bindBuffer: () => {},
        bufferData: () => {},
        createTexture: () => ({}),
        bindTexture: () => {},
        texImage2D: () => {},
        texParameteri: () => {},
        createFramebuffer: () => ({}),
        bindFramebuffer: () => {},
        framebufferTexture2D: () => {},
        checkFramebufferStatus: () => 36053, // FRAMEBUFFER_COMPLETE
        deleteShader: () => {},
        deleteProgram: () => {},
        deleteBuffer: () => {},
        deleteTexture: () => {},
        deleteFramebuffer: () => {},
        getUniformLocation: () => ({}),
        uniform1f: () => {},
        uniform2f: () => {},
        uniform3f: () => {},
        uniform4f: () => {},
        uniformMatrix4fv: () => {},
        enableVertexAttribArray: () => {},
        vertexAttribPointer: () => {},
        drawArrays: () => {},
        enable: () => {},
        disable: () => {},
        blendFunc: () => {},
        depthFunc: () => {},
      } as any;
    }

    // Fall back to original for other context types
    return originalGetContext.call(this, contextId, options);
  };
}

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
