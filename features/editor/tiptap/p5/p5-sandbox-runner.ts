type P5Lifecycle = (...args: unknown[]) => unknown;

interface P5Program {
  preload?: P5Lifecycle;
  setup?: P5Lifecycle;
  draw?: P5Lifecycle;
}

interface P5Scope {
  preload?: P5Lifecycle;
  setup?: P5Lifecycle;
  draw?: P5Lifecycle;
}

interface P5Instance {
  remove?: () => void;
}

type P5Constructor = new (sketch: (scope: P5Scope) => void, mountId: string) => P5Instance;

type P5SandboxWindow = Window &
  typeof globalThis & {
    p5?: P5Constructor;
    __startP5?: () => void;
    __loadP5Fallback?: () => void;
  };

export interface P5SandboxRunnerOptions {
  source: string;
  channel: string;
  fallbackLibraryUrl: string;
  libraryIntegrity: string;
}

/** Self-contained runtime serialized into the opaque, device-free iframe. */
export function installP5SandboxRunner(
  runnerWindow: P5SandboxWindow,
  { source, channel, fallbackLibraryUrl, libraryIntegrity }: P5SandboxRunnerOptions,
): void {
  const runnerDocument = runnerWindow.document;
  const parentWindow = runnerWindow.parent;
  const native = {
    setTimeout: runnerWindow.setTimeout.bind(runnerWindow) as (
      callback: (...args: unknown[]) => void,
      delay?: number,
      ...args: unknown[]
    ) => number,
    clearTimeout: runnerWindow.clearTimeout.bind(runnerWindow),
    setInterval: runnerWindow.setInterval.bind(runnerWindow) as (
      callback: (...args: unknown[]) => void,
      delay?: number,
      ...args: unknown[]
    ) => number,
    clearInterval: runnerWindow.clearInterval.bind(runnerWindow),
    requestAnimationFrame: runnerWindow.requestAnimationFrame.bind(runnerWindow),
    cancelAnimationFrame: runnerWindow.cancelAnimationFrame.bind(runnerWindow),
  };
  const timers = new Set<number>();
  const intervals = new Set<number>();
  const frames = new Set<number>();
  let instance: P5Instance | null = null;
  let heartbeat: number | null = null;
  let ready = false;
  let fallbackRequested = false;

  const send = (type: string, payload: Record<string, unknown> = {}) =>
    parentWindow.postMessage({ channel, type, ...payload }, '*');
  const errorMessage = (value: unknown, fallback = 'Sketch failed') => {
    const message = value instanceof Error ? value.message : value;
    return String(message || fallback)
      .replace(/(?:https?|blob):\/\/\S+/gu, '[resource]')
      .slice(0, 500);
  };
  const clean = () => {
    if (heartbeat !== null) {
      native.clearInterval(heartbeat);
      heartbeat = null;
    }
    try {
      instance?.remove?.();
    } catch {
      // Remaining browser resources are released below.
    }
    instance = null;
    ready = false;
    timers.forEach(native.clearTimeout);
    intervals.forEach(native.clearInterval);
    frames.forEach(native.cancelAnimationFrame);
    timers.clear();
    intervals.clear();
    frames.clear();
    runnerDocument.querySelectorAll('canvas').forEach((canvas) => {
      for (const kind of ['webgl2', 'webgl'] as const) {
        try {
          const context = canvas.getContext(kind) as WebGLRenderingContext | WebGL2RenderingContext | null;
          context?.getExtension('WEBGL_lose_context')?.loseContext();
        } catch {
          // Context loss is an optional browser extension.
        }
      }
    });
    runnerDocument.getElementById('sketch')?.replaceChildren();
  };
  const signalReady = () => {
    if (ready) {
      return;
    }
    const canvas = runnerDocument.querySelector('#sketch canvas');
    if (!(canvas instanceof runnerWindow.HTMLCanvasElement) || !canvas.isConnected) {
      throw new runnerWindow.Error('p5.js did not attach a canvas to the preview surface.');
    }
    ready = true;
    heartbeat = native.setInterval(() => send('heartbeat'), 250);
    send('ready');
  };
  const blockNetwork = () => {
    const blocked = () => Promise.reject(new runnerWindow.Error('Network access is disabled in p5.js previews.'));
    class BlockedNetworkApi {
      constructor() {
        throw new runnerWindow.Error('Network access is disabled in p5.js previews.');
      }
    }
    Object.defineProperties(runnerWindow, {
      fetch: { value: blocked, configurable: false, writable: false },
      XMLHttpRequest: { value: BlockedNetworkApi, configurable: false, writable: false },
      WebSocket: { value: BlockedNetworkApi, configurable: false, writable: false },
      EventSource: { value: BlockedNetworkApi, configurable: false, writable: false },
      Worker: { value: BlockedNetworkApi, configurable: false, writable: false },
      SharedWorker: { value: BlockedNetworkApi, configurable: false, writable: false },
      indexedDB: { value: undefined, configurable: false, writable: false },
      caches: { value: undefined, configurable: false, writable: false },
    });
    Object.defineProperty(runnerWindow.navigator, 'sendBeacon', { value: () => false, configurable: false });
  };
  const trackTimers = () => {
    const setTimeout = (callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
      const id = native.setTimeout(() => {
        timers.delete(id);
        callback(...args);
      }, delay);
      timers.add(id);
      return id;
    };
    const clearTimeout = (id: number) => {
      timers.delete(id);
      native.clearTimeout(id);
    };
    const setInterval = (callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
      const id = native.setInterval(callback, delay, ...args);
      intervals.add(id);
      return id;
    };
    const clearInterval = (id: number) => {
      intervals.delete(id);
      native.clearInterval(id);
    };
    const requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = native.requestAnimationFrame((time) => {
        frames.delete(id);
        callback(time);
      });
      frames.add(id);
      return id;
    };
    const cancelAnimationFrame = (id: number) => {
      frames.delete(id);
      native.cancelAnimationFrame(id);
    };
    Object.defineProperties(runnerWindow, {
      setTimeout: { value: setTimeout, configurable: false, writable: false },
      clearTimeout: { value: clearTimeout, configurable: false, writable: false },
      setInterval: { value: setInterval, configurable: false, writable: false },
      clearInterval: { value: clearInterval, configurable: false, writable: false },
      requestAnimationFrame: { value: requestAnimationFrame, configurable: false, writable: false },
      cancelAnimationFrame: { value: cancelAnimationFrame, configurable: false, writable: false },
    });
  };

  blockNetwork();
  trackTimers();
  runnerWindow.addEventListener('message', (event) => {
    if (event.data?.channel !== channel || event.data?.type !== 'dispose') {
      return;
    }
    clean();
    send('stopped');
  });
  runnerWindow.addEventListener('error', (event) => {
    send('error', {
      error: {
        kind: event.error instanceof runnerWindow.SyntaxError ? 'compile' : 'runtime',
        message: errorMessage(event.message),
        line: event.lineno || undefined,
        column: event.colno || undefined,
      },
    });
    clean();
  });
  runnerWindow.addEventListener('unhandledrejection', (event) => {
    send('error', { error: { kind: 'runtime', message: errorMessage(event.reason) } });
    clean();
  });
  runnerWindow.__startP5 = () => {
    try {
      if (typeof runnerWindow.p5 !== 'function') {
        throw new runnerWindow.Error('Bundled p5.js runtime did not load.');
      }
      const sketch = (scope: P5Scope) => {
        const compile = new runnerWindow.Function(
          'scope',
          `with (scope) {\n${source}\n//# sourceURL=p5-sketch.js\nreturn { preload: typeof preload === "function" ? preload : undefined, setup: typeof setup === "function" ? setup : undefined, draw: typeof draw === "function" ? draw : undefined };\n}`,
        ) as (scope: P5Scope) => P5Program;
        const program = compile(scope);
        if (program.preload) {
          scope.preload = program.preload;
        }
        scope.setup = async (...args) => {
          await program.setup?.(...args);
          if (!program.draw) {
            native.requestAnimationFrame(signalReady);
          }
        };
        if (program.draw) {
          scope.draw = async (...args) => {
            await program.draw?.(...args);
            signalReady();
          };
        }
      };
      instance = new runnerWindow.p5(sketch, 'sketch');
    } catch (error) {
      send('error', {
        error: {
          kind: error instanceof runnerWindow.SyntaxError ? 'compile' : 'runtime',
          message: errorMessage(error),
        },
      });
      clean();
    }
  };
  runnerWindow.__loadP5Fallback = () => {
    if (fallbackRequested) {
      return;
    }
    fallbackRequested = true;
    const fallback = runnerDocument.createElement('script');
    fallback.src = fallbackLibraryUrl;
    fallback.integrity = libraryIntegrity;
    fallback.crossOrigin = 'anonymous';
    fallback.referrerPolicy = 'no-referrer';
    fallback.onload = runnerWindow.__startP5 ?? null;
    fallback.onerror = () =>
      send('error', { error: { kind: 'resource', message: 'Bundled p5.js runtime could not be loaded.' } });
    runnerDocument.head.append(fallback);
  };
}
