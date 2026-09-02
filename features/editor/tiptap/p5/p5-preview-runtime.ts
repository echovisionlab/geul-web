import { getPublicP5RunnerUrl } from '@/lib/public-runtime-config';
import { validateP5SketchSource, type P5SketchError } from './p5-source';
import { normalizeP5Capabilities, type P5Capability } from './p5-capabilities';
import type { P5PreflightMessage, P5RuntimeMessage } from './p5-preview-protocol';
import { buildP5SandboxDocument } from './p5-preview-document';
import { resolveP5RunnerUrl } from './p5-runner-url';

export { buildP5SandboxDocument } from './p5-preview-document';

export interface P5PreviewRuntimeEvents {
  onReady: () => void;
  onStopped: () => void;
  onError: (error: P5SketchError) => void;
  onPermissionPending?: (capabilities: readonly P5Capability[]) => void;
  onPermissionGranted?: (capabilities: readonly P5Capability[]) => void;
}

export interface P5PreviewRunOptions {
  capabilities?: readonly P5Capability[];
}

export interface P5PreviewRuntime {
  run: (source: string, options?: P5PreviewRunOptions) => void;
  stop: () => void;
  dispose: () => void;
}

export type P5PreviewRuntimeFactory = (mount: HTMLElement, events: P5PreviewRuntimeEvents) => P5PreviewRuntime;

const PREFLIGHT_TIMEOUT_MS = 750;
const PREFLIGHT_STARTUP_TIMEOUT_MS = 5_000;
const HEARTBEAT_TIMEOUT_MS = 1_500;

interface P5PendingDeviceInit {
  source: string;
  capabilities: P5Capability[];
}

interface P5PreviewFrameBoundary {
  frame: HTMLIFrameElement;
  targetOrigin: string;
  pendingDeviceInit: P5PendingDeviceInit | null;
}

function permissionsPolicy(capabilities: readonly P5Capability[], origin: string): string {
  const features: Record<P5Capability, readonly string[]> = {
    camera: ['camera'],
    microphone: ['microphone'],
    motion: ['accelerometer', 'gyroscope'],
    midi: ['midi'],
    gamepad: ['gamepad'],
    serial: ['serial'],
    location: ['geolocation'],
    bluetooth: ['bluetooth'],
  };
  return [...new Set(capabilities.flatMap((capability) => features[capability]))]
    .map((feature) => `${feature} ${origin}`)
    .join('; ');
}

function createP5PreviewFrame(
  source: string,
  channel: string,
  capabilities: P5Capability[],
  deviceRunnerUrl: URL | null,
): P5PreviewFrameBoundary {
  const frame = document.createElement('iframe');
  frame.title = 'p5.js preview';
  frame.setAttribute('referrerpolicy', 'no-referrer');

  if (capabilities.length === 0) {
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('allow', '');
    frame.srcdoc = buildP5SandboxDocument(source, channel);
    return { frame, targetOrigin: '*', pendingDeviceInit: null };
  }

  if (!deviceRunnerUrl) {
    throw new TypeError('Device-enabled p5.js previews require a configured isolated runner origin.');
  }
  const targetOrigin = deviceRunnerUrl.origin;
  frame.setAttribute('allow', permissionsPolicy(capabilities, targetOrigin));
  const frameUrl = new URL(deviceRunnerUrl);
  frameUrl.hash = new URLSearchParams({ channel }).toString();
  frame.src = frameUrl.toString();
  return {
    frame,
    targetOrigin,
    pendingDeviceInit: { source, capabilities },
  };
}

/**
 * Runs source after a disposable worker preflight. Ordinary sketches use an
 * opaque iframe. Device-enabled sketches use a cookie-isolated runner origin,
 * so public temporary edits can request capabilities without receiving the
 * site's origin or session authority. A new run always destroys both
 * boundaries, and watchdogs terminate a hung setup/draw.
 */
export const createP5PreviewRuntime: P5PreviewRuntimeFactory = (mount, events) => {
  let preflight: Worker | null = null;
  let frame: HTMLIFrameElement | null = null;
  let preflightTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  let channel = '';
  let frameTargetOrigin = '*';
  let pendingDeviceInit: P5PendingDeviceInit | null = null;
  let disposed = false;

  const clearTimers = () => {
    if (preflightTimer) {
      clearTimeout(preflightTimer);
    }
    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer);
    }
    preflightTimer = null;
    heartbeatTimer = null;
  };
  const destroyBoundaries = () => {
    clearTimers();
    preflight?.terminate();
    preflight = null;
    if (frame) {
      frame.contentWindow?.postMessage({ channel, type: 'dispose' }, frameTargetOrigin);
      frame.remove();
      frame = null;
    }
    mount.replaceChildren();
    frameTargetOrigin = '*';
    pendingDeviceInit = null;
  };
  const fail = (error: P5SketchError) => {
    destroyBoundaries();
    events.onError(error);
  };
  const armHeartbeat = () => {
    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer);
    }
    heartbeatTimer = setTimeout(() => {
      fail({ kind: 'resource', message: 'The p5.js preview exceeded its CPU budget and was terminated.' });
    }, HEARTBEAT_TIMEOUT_MS);
  };
  const onWindowMessage = (event: MessageEvent<P5RuntimeMessage>) => {
    if (
      !frame ||
      event.source !== frame.contentWindow ||
      event.data?.channel !== channel ||
      (frameTargetOrigin !== '*' && event.origin !== frameTargetOrigin)
    ) {
      return;
    }
    switch (event.data.type) {
      case 'runner-ready': {
        if (!pendingDeviceInit || frameTargetOrigin === '*') {
          return;
        }
        const init = pendingDeviceInit;
        pendingDeviceInit = null;
        frame.contentWindow?.postMessage({ channel, type: 'init', ...init }, frameTargetOrigin);
        armHeartbeat();
        return;
      }
      case 'ready':
        events.onReady();
        armHeartbeat();
        return;
      case 'heartbeat':
        armHeartbeat();
        return;
      case 'stopped':
        destroyBoundaries();
        events.onStopped();
        return;
      case 'error':
        fail(event.data.error);
        return;
      case 'permission-pending':
        events.onPermissionPending?.(normalizeP5Capabilities(event.data.capabilities));
        armHeartbeat();
        return;
      case 'permission-granted':
        events.onPermissionGranted?.(normalizeP5Capabilities(event.data.capabilities));
        armHeartbeat();
    }
  };
  globalThis.addEventListener('message', onWindowMessage as EventListener);

  return {
    run(source, options) {
      if (disposed) {
        return;
      }
      destroyBoundaries();
      const capabilities = normalizeP5Capabilities(options?.capabilities ?? []);
      const policyError = validateP5SketchSource(source, capabilities);
      if (policyError) {
        events.onError(policyError);
        return;
      }
      const deviceRunnerUrl =
        capabilities.length > 0 ? resolveP5RunnerUrl(getPublicP5RunnerUrl(), globalThis.location.origin) : null;
      if (capabilities.length > 0 && !deviceRunnerUrl) {
        events.onError({
          kind: 'resource',
          message: 'Device-enabled p5.js previews require a configured isolated runner origin.',
        });
        return;
      }
      channel = globalThis.crypto?.randomUUID?.() ?? `p5-${Date.now().toString(36)}`;
      try {
        const worker = new Worker(new URL('./p5-preflight.worker.ts', import.meta.url), {
          type: 'module',
          name: 'p5-sketch-preflight',
        });
        preflight = worker;
        worker.onmessage = (event: MessageEvent<P5PreflightMessage>) => {
          if (preflight !== worker) {
            return;
          }
          if (event.data.type === 'error') {
            fail(event.data.error);
            return;
          }
          if (event.data.type === 'initialized') {
            if (preflightTimer) {
              clearTimeout(preflightTimer);
            }
            worker.postMessage({ type: 'preflight', source });
            preflightTimer = setTimeout(() => {
              if (preflight !== worker) {
                return;
              }
              fail({ kind: 'resource', message: 'The p5.js sketch exceeded its setup CPU budget and was terminated.' });
            }, PREFLIGHT_TIMEOUT_MS);
            return;
          }
          if (preflightTimer) {
            clearTimeout(preflightTimer);
          }
          preflightTimer = null;
          worker.terminate();
          preflight = null;
          const boundary = createP5PreviewFrame(source, channel, capabilities, deviceRunnerUrl);
          frame = boundary.frame;
          frameTargetOrigin = boundary.targetOrigin;
          pendingDeviceInit = boundary.pendingDeviceInit;
          mount.replaceChildren(frame);
          armHeartbeat();
        };
        worker.onerror = () => fail({ kind: 'runtime', message: 'The isolated p5.js preflight failed.' });
        preflightTimer = setTimeout(() => {
          if (preflight !== worker) {
            return;
          }
          fail({ kind: 'resource', message: 'The isolated p5.js preflight could not be started.' });
        }, PREFLIGHT_STARTUP_TIMEOUT_MS);
      } catch {
        fail({ kind: 'resource', message: 'The isolated p5.js preview could not be started.' });
      }
    },
    stop() {
      destroyBoundaries();
      events.onStopped();
    },
    dispose() {
      disposed = true;
      destroyBoundaries();
      globalThis.removeEventListener('message', onWindowMessage as EventListener);
    },
  };
};
