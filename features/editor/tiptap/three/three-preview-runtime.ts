import { validateThreeSceneSource, type ThreeSceneError } from './three-source';

export interface ThreePreviewRuntimeEvents {
  onReady: () => void;
  onStopped: () => void;
  onError: (error: ThreeSceneError) => void;
}

export interface ThreePreviewRuntime {
  run: (source: string) => void;
  stop: () => void;
  dispose: () => void;
}

export type ThreePreviewRuntimeFactory = (
  canvas: HTMLCanvasElement,
  events: ThreePreviewRuntimeEvents,
) => ThreePreviewRuntime;

type RuntimeWorkerMessage = { type: 'ready' | 'heartbeat' | 'stopped' } | { type: 'error'; error: ThreeSceneError };

type TranspileWorkerMessage = { type: 'compiled'; source: string } | { type: 'error'; error: ThreeSceneError };

const COMPILE_TIMEOUT_MS = 8_000;
const START_TIMEOUT_MS = 5_000;
const HEARTBEAT_TIMEOUT_MS = 1_500;
const STOP_GRACE_MS = 100;

/**
 * Runs author source only in a disposable module worker. It cannot reach the
 * editor DOM or same-origin page state; the worker itself disables network and
 * storage APIs before evaluating source. A hung setup/frame is terminated by
 * the main-thread watchdog instead of blocking editor input or autosave.
 */
export const createThreePreviewWorkerRuntime: ThreePreviewRuntimeFactory = (canvas, events) => {
  let worker: Worker | null = null;
  let transpileWorker: Worker | null = null;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const clearTimers = () => {
    if (watchdog) {
      clearTimeout(watchdog);
    }
    if (stopTimer) {
      clearTimeout(stopTimer);
    }
    watchdog = null;
    stopTimer = null;
  };
  const terminate = () => {
    clearTimers();
    worker?.terminate();
    worker = null;
    transpileWorker?.terminate();
    transpileWorker = null;
  };
  const armWatchdog = (message: string, timeout = worker ? HEARTBEAT_TIMEOUT_MS : START_TIMEOUT_MS) => {
    if (watchdog) {
      clearTimeout(watchdog);
    }
    watchdog = setTimeout(() => {
      terminate();
      events.onError({ kind: 'resource', message });
    }, timeout);
  };

  return {
    run(source) {
      if (disposed) {
        return;
      }
      terminate();
      const policyError = validateThreeSceneSource(source);
      if (policyError) {
        events.onError(policyError);
        return;
      }
      if (typeof canvas.transferControlToOffscreen !== 'function') {
        events.onError({ kind: 'resource', message: 'This browser cannot isolate the Three.js preview canvas.' });
        return;
      }

      try {
        const bounds = canvas.getBoundingClientRect();
        const pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.round((bounds.width || 960) * pixelRatio));
        canvas.height = Math.max(1, Math.round((bounds.height || 360) * pixelRatio));
        const offscreen = canvas.transferControlToOffscreen();
        transpileWorker = new Worker(new URL('./three-transpile.worker.ts', import.meta.url), {
          type: 'module',
          name: 'three-scene-transpile',
        });
        transpileWorker.onmessage = (event: MessageEvent<TranspileWorkerMessage>) => {
          const transpiled = event.data;
          transpileWorker?.terminate();
          transpileWorker = null;
          if (transpiled.type === 'error') {
            terminate();
            events.onError(transpiled.error);
            return;
          }
          worker = new Worker(new URL('./three-preview.worker.ts', import.meta.url), {
            type: 'module',
            name: 'three-scene-preview',
          });
          worker.onmessage = (previewEvent: MessageEvent<RuntimeWorkerMessage>) => {
            const message = previewEvent.data;
            if (message.type === 'ready') {
              events.onReady();
              armWatchdog('The Three.js preview stopped responding and was terminated.');
            } else if (message.type === 'heartbeat') {
              armWatchdog('The Three.js preview exceeded its frame budget and was terminated.');
            } else if (message.type === 'stopped') {
              terminate();
              events.onStopped();
            } else if (message.type === 'error') {
              terminate();
              events.onError(message.error);
            }
          };
          worker.onerror = () => {
            terminate();
            events.onError({ kind: 'runtime', message: 'The isolated Three.js preview failed.' });
          };
          worker.postMessage({ type: 'start', source: transpiled.source, canvas: offscreen }, [offscreen]);
          armWatchdog('The Three.js preview did not start in time and was terminated.', START_TIMEOUT_MS);
        };
        transpileWorker.onerror = () => {
          terminate();
          events.onError({ kind: 'compile', message: 'The TypeScript source could not be compiled.' });
        };
        transpileWorker.postMessage({ type: 'transpile', source });
        armWatchdog('The Three.js source did not compile in time and was terminated.', COMPILE_TIMEOUT_MS);
      } catch {
        terminate();
        events.onError({ kind: 'resource', message: 'The isolated Three.js preview could not be started.' });
      }
    },
    stop() {
      if (!worker && !transpileWorker) {
        events.onStopped();
        return;
      }
      if (watchdog) {
        clearTimeout(watchdog);
      }
      watchdog = null;
      if (transpileWorker) {
        terminate();
        events.onStopped();
        return;
      }
      worker?.postMessage({ type: 'stop' });
      stopTimer = setTimeout(() => {
        terminate();
        events.onStopped();
      }, STOP_GRACE_MS);
    },
    dispose() {
      disposed = true;
      terminate();
    },
  };
};
