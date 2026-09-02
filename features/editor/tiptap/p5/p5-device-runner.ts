import type { P5Capability } from './p5-capabilities';
import type { P5RuntimeMessage } from './p5-preview-protocol';
import type { P5SketchError } from './p5-source';

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
  requestMIDIAccess?: (options?: unknown) => Promise<unknown>;
  getGamepads?: () => readonly (Gamepad | null)[];
  requestSerialPort?: (options?: unknown) => Promise<unknown>;
  getSerialPorts?: () => Promise<readonly unknown[]>;
  requestMotionPermission?: () => Promise<'granted'>;
  requestCurrentPosition?: (options?: PositionOptions) => Promise<GeolocationPosition>;
  requestBluetoothDevice?: (options: unknown) => Promise<unknown>;
}

interface P5Instance {
  remove?: () => void;
}

type P5Constructor = new (sketch: (scope: P5Scope) => void, mountId: string) => P5Instance;
type P5Closeable = { close?: () => Promise<unknown> | unknown };
interface P5MidiAccess {
  inputs?: { values?: () => Iterable<P5Closeable> };
  outputs?: { values?: () => Iterable<P5Closeable> };
}
interface P5BluetoothDevice {
  gatt?: { disconnect?: () => void };
}

type P5DeviceRunnerWindow = Window &
  typeof globalThis & {
    p5?: P5Constructor;
  };

interface P5DeviceRunnerInitMessage {
  channel: string;
  type: 'init';
  source: string;
  capabilities: unknown[];
}

interface P5DeviceRunnerDisposeMessage {
  channel: string;
  type: 'dispose';
}

type P5DeviceRunnerCommand = P5DeviceRunnerInitMessage | P5DeviceRunnerDisposeMessage;
type P5RuntimeMessagePayload = P5RuntimeMessage extends infer Message
  ? Message extends { channel: string }
    ? Omit<Message, 'channel'>
    : never
  : never;

export interface P5DeviceRunnerOptions {
  channel: string;
  parentOrigin: string;
}

export interface P5DeviceRunner {
  dispose: () => void;
}

/**
 * Self-contained so its source can run inside the isolated device frame.
 * Keep every runtime value inside this function; imported names must stay types.
 */
export function installP5DeviceRunner(
  runnerWindow: P5DeviceRunnerWindow,
  { channel, parentOrigin }: P5DeviceRunnerOptions,
): P5DeviceRunner {
  const maxSourceLength = 100_000;
  const heartbeatIntervalMs = 250;
  const normalizeCapabilities = (values: readonly unknown[]): P5Capability[] =>
    (['camera', 'microphone', 'motion', 'midi', 'gamepad', 'serial', 'location', 'bluetooth'] as const).filter(
      (capability) => values.includes(capability),
    );
  const errorMessage = (value: unknown, fallback = 'The p5.js sketch failed.'): string => {
    const message = value instanceof Error ? value.message : value;
    return String(message || fallback)
      .replace(/(?:https?|blob):\/\/\S+/gu, '[resource]')
      .replace(/\s+/gu, ' ')
      .trim()
      .slice(0, 500);
  };
  const isRunnerCommand = (value: unknown): value is P5DeviceRunnerCommand => {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const command = value as Record<string, unknown>;
    if (command.type === 'dispose') {
      return typeof command.channel === 'string';
    }
    return (
      command.type === 'init' &&
      typeof command.channel === 'string' &&
      typeof command.source === 'string' &&
      Array.isArray(command.capabilities)
    );
  };
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
  const streams = new Set<MediaStream>();
  const serialPorts = new Set<P5Closeable>();
  const midiConnections = new Set<P5MidiAccess>();
  const bluetoothDevices = new Set<P5BluetoothDevice>();
  let instance: P5Instance | null = null;
  let heartbeat: number | null = null;
  let ready = false;
  let readyRequested = false;
  let initialized = false;
  let failed = false;
  let pendingMediaRequests = 0;

  const send = (message: P5RuntimeMessagePayload) => {
    parentWindow.postMessage({ channel, ...message }, parentOrigin);
  };
  const stopStream = (stream: MediaStream) => {
    try {
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      // A partially initialized stream still needs to be forgotten.
    }
    streams.delete(stream);
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
    readyRequested = false;
    streams.forEach(stopStream);
    serialPorts.forEach((port) => void Promise.resolve(port.close?.()).catch(() => undefined));
    serialPorts.clear();
    midiConnections.forEach((access) => {
      for (const collection of [access.inputs, access.outputs]) {
        for (const connection of collection?.values?.() ?? []) {
          void Promise.resolve(connection.close?.()).catch(() => undefined);
        }
      }
    });
    midiConnections.clear();
    bluetoothDevices.forEach((device) => {
      try {
        device.gatt?.disconnect?.();
      } catch {
        // A device may disconnect itself before preview teardown.
      }
    });
    bluetoothDevices.clear();
    runnerDocument.querySelectorAll<HTMLMediaElement>('video,audio').forEach((element) => {
      if (element.srcObject instanceof runnerWindow.MediaStream) {
        stopStream(element.srcObject);
      }
      try {
        element.srcObject = null;
      } catch {
        // Some media elements expose a read-only srcObject during teardown.
      }
    });
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
  const fail = (kind: P5SketchError['kind'], value: unknown) => {
    if (failed) {
      return;
    }
    failed = true;
    send({ type: 'error', error: { kind, message: errorMessage(value) } });
    clean();
  };
  const signalReady = () => {
    if (failed || ready) {
      return;
    }
    if (pendingMediaRequests > 0) {
      readyRequested = true;
      return;
    }
    const canvas = runnerDocument.querySelector('#sketch canvas');
    if (!(canvas instanceof runnerWindow.HTMLCanvasElement) || !canvas.isConnected) {
      fail('runtime', 'p5.js did not attach a canvas to the preview surface.');
      return;
    }
    ready = true;
    send({ type: 'ready' });
  };
  const startHeartbeat = () => {
    if (heartbeat === null) {
      heartbeat = native.setInterval(() => send({ type: 'heartbeat' }), heartbeatIntervalMs);
    }
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
    Object.defineProperty(runnerWindow.navigator, 'sendBeacon', {
      value: () => false,
      configurable: false,
    });
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
  const installMediaPolicy = (capabilities: readonly P5Capability[]) => {
    if (!capabilities.includes('camera') && !capabilities.includes('microphone')) {
      return true;
    }
    const mediaDevices = runnerWindow.navigator.mediaDevices;
    const nativeGetUserMedia = mediaDevices?.getUserMedia?.bind(mediaDevices);
    if (!nativeGetUserMedia) {
      fail('permission', 'Camera and microphone access are unavailable in this browser.');
      return false;
    }
    Object.defineProperty(mediaDevices, 'getUserMedia', {
      configurable: false,
      writable: false,
      value: async (constraints: MediaStreamConstraints = {}) => {
        const requested = normalizeCapabilities([
          constraints.video ? 'camera' : null,
          constraints.audio ? 'microphone' : null,
        ]);
        if (requested.length === 0 || requested.some((capability) => !capabilities.includes(capability))) {
          const error = new runnerWindow.DOMException(
            'The sketch requested an undeclared device capability.',
            'NotAllowedError',
          );
          fail('permission', error.message);
          throw error;
        }
        pendingMediaRequests += 1;
        send({ type: 'permission-pending', capabilities: requested });
        try {
          const stream = await nativeGetUserMedia(constraints);
          streams.add(stream);
          stream.getTracks().forEach((track) => {
            track.addEventListener(
              'ended',
              () => {
                if (stream.getTracks().every((candidate) => candidate.readyState === 'ended')) {
                  streams.delete(stream);
                }
              },
              { once: true },
            );
          });
          send({ type: 'permission-granted', capabilities: requested });
          return stream;
        } catch (error) {
          fail(
            'permission',
            error instanceof runnerWindow.DOMException && error.name === 'NotAllowedError'
              ? 'Camera or microphone permission was denied.'
              : 'Camera or microphone access is unavailable.',
          );
          throw error;
        } finally {
          pendingMediaRequests = Math.max(0, pendingMediaRequests - 1);
          if (readyRequested && pendingMediaRequests === 0 && !failed) {
            signalReady();
          }
        }
      },
    });
    return true;
  };
  const installCapabilityApis = (capabilities: readonly P5Capability[]) => {
    const browserNavigator = runnerWindow.navigator as Navigator & {
      bluetooth?: {
        requestDevice?: (options: unknown) => Promise<unknown>;
      };
      requestMIDIAccess?: (options?: unknown) => Promise<unknown>;
      serial?: {
        requestPort?: (options?: unknown) => Promise<unknown>;
        getPorts?: () => Promise<readonly unknown[]>;
      };
    };
    const requireCapability = (capability: P5Capability) => {
      if (capabilities.includes(capability)) {
        return;
      }
      const error = new runnerWindow.DOMException(
        `The sketch requested the undeclared ${capability} capability.`,
        'NotAllowedError',
      );
      fail('permission', error.message);
      throw error;
    };
    const permissionRequest = async <Value>(
      capability: P5Capability,
      request: (() => Promise<Value>) | undefined,
      unavailable: string,
    ): Promise<Value> => {
      requireCapability(capability);
      if (!request) {
        const error = new runnerWindow.DOMException(unavailable, 'NotSupportedError');
        fail('permission', error.message);
        throw error;
      }
      send({ type: 'permission-pending', capabilities: [capability] });
      try {
        const value = await request();
        send({ type: 'permission-granted', capabilities: [capability] });
        return value;
      } catch (error) {
        fail('permission', error instanceof runnerWindow.Error ? error.message : unavailable);
        throw error;
      }
    };
    const requestMIDIAccess = async (options?: unknown) => {
      const access = await permissionRequest(
        'midi',
        browserNavigator.requestMIDIAccess?.bind(browserNavigator, options),
        'MIDI access is unavailable in this browser.',
      );
      midiConnections.add(access as P5MidiAccess);
      return access;
    };
    const getGamepads = () => {
      requireCapability('gamepad');
      if (typeof browserNavigator.getGamepads !== 'function') {
        throw new runnerWindow.DOMException('Gamepad input is unavailable in this browser.', 'NotSupportedError');
      }
      return browserNavigator.getGamepads();
    };
    const requestSerialPort = async (options?: unknown) => {
      const port = await permissionRequest(
        'serial',
        browserNavigator.serial?.requestPort?.bind(browserNavigator.serial, options),
        'Serial access is unavailable in this browser.',
      );
      serialPorts.add(port as P5Closeable);
      return port;
    };
    const getSerialPorts = async () => {
      requireCapability('serial');
      const ports = await permissionRequest(
        'serial',
        browserNavigator.serial?.getPorts?.bind(browserNavigator.serial),
        'Serial access is unavailable in this browser.',
      );
      ports.forEach((port) => serialPorts.add(port as P5Closeable));
      return ports;
    };
    const requestMotionPermission = async (): Promise<'granted'> => {
      requireCapability('motion');
      const motionEvent = runnerWindow.DeviceMotionEvent as typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (!motionEvent) {
        throw new runnerWindow.DOMException('Motion input is unavailable in this browser.', 'NotSupportedError');
      }
      if (typeof motionEvent.requestPermission !== 'function') {
        return 'granted';
      }
      const permission = await permissionRequest(
        'motion',
        motionEvent.requestPermission.bind(motionEvent),
        'Motion permission is unavailable in this browser.',
      );
      if (permission !== 'granted') {
        const error = new runnerWindow.DOMException('Motion permission was denied.', 'NotAllowedError');
        fail('permission', error.message);
        throw error;
      }
      return 'granted';
    };
    const requestCurrentPosition = (options?: PositionOptions) => {
      const geolocation = browserNavigator.geolocation;
      return permissionRequest(
        'location',
        geolocation
          ? () =>
              new Promise<GeolocationPosition>((resolve, reject) => {
                geolocation.getCurrentPosition(resolve, reject, options);
              })
          : undefined,
        'Location access is unavailable in this browser.',
      );
    };
    const requestBluetoothDevice = async (options: unknown) => {
      const device = await permissionRequest(
        'bluetooth',
        browserNavigator.bluetooth?.requestDevice?.bind(browserNavigator.bluetooth, options),
        'Bluetooth access is unavailable in this browser.',
      );
      bluetoothDevices.add(device as P5BluetoothDevice);
      return device;
    };
    return {
      requestMIDIAccess,
      getGamepads,
      requestSerialPort,
      getSerialPorts,
      requestMotionPermission,
      requestCurrentPosition,
      requestBluetoothDevice,
    };
  };
  const run = (source: string, capabilities: readonly P5Capability[]) => {
    if (typeof runnerWindow.p5 !== 'function') {
      fail('resource', 'Bundled p5.js runtime could not be loaded.');
      return;
    }
    blockNetwork();
    if (!installMediaPolicy(capabilities)) {
      return;
    }
    const capabilityApis = installCapabilityApis(capabilities);
    trackTimers();
    try {
      const sketch = (scope: P5Scope) => {
        Object.assign(scope, capabilityApis);
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
      fail(error instanceof runnerWindow.SyntaxError ? 'compile' : 'runtime', error);
    }
  };
  const onMessage = (event: MessageEvent<unknown>) => {
    if (event.source !== parentWindow || event.origin !== parentOrigin || !isRunnerCommand(event.data)) {
      return;
    }
    if (event.data.channel !== channel) {
      return;
    }
    if (event.data.type === 'dispose') {
      clean();
      send({ type: 'stopped' });
      return;
    }
    if (initialized) {
      return;
    }
    const capabilities = normalizeCapabilities(event.data.capabilities);
    if (!event.data.source || capabilities.length === 0 || event.data.source.length > maxSourceLength) {
      fail('policy', 'The device-enabled p5.js runner received invalid input.');
      return;
    }
    initialized = true;
    startHeartbeat();
    run(event.data.source, capabilities);
  };
  const onError = (event: ErrorEvent) =>
    fail(event.error instanceof runnerWindow.SyntaxError ? 'compile' : 'runtime', event.message);
  const onUnhandledRejection = (event: PromiseRejectionEvent) => fail('runtime', event.reason);
  const onPageHide = () => clean();
  const onVisibilityChange = () => {
    if (runnerDocument.hidden && initialized) {
      clean();
      send({ type: 'stopped' });
    }
  };

  runnerWindow.addEventListener('message', onMessage);
  runnerWindow.addEventListener('error', onError);
  runnerWindow.addEventListener('unhandledrejection', onUnhandledRejection);
  runnerWindow.addEventListener('pagehide', onPageHide, { once: true });
  runnerDocument.addEventListener('visibilitychange', onVisibilityChange);
  send({ type: 'runner-ready' });

  return {
    dispose() {
      clean();
      runnerWindow.removeEventListener('message', onMessage);
      runnerWindow.removeEventListener('error', onError);
      runnerWindow.removeEventListener('unhandledrejection', onUnhandledRejection);
      runnerWindow.removeEventListener('pagehide', onPageHide);
      runnerDocument.removeEventListener('visibilitychange', onVisibilityChange);
    },
  };
}
