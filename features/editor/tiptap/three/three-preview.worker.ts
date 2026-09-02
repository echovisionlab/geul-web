import * as THREE from 'three';
import type { ThreeSceneError, ThreeSceneErrorKind } from './three-source';

type WorkerStartMessage = { type: 'start'; source: string; canvas: OffscreenCanvas };
type WorkerStopMessage = { type: 'stop' };

type SceneProgram = {
  frame?: (time: number) => void;
  dispose?: () => void;
};

const runtime = globalThis as typeof globalThis & {
  postMessage: (message: unknown) => void;
  onmessage: ((event: MessageEvent<WorkerStartMessage | WorkerStopMessage>) => void) | null;
};
const SourceFunction = Function;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.Camera | null = null;
let frameTimer: ReturnType<typeof setTimeout> | null = null;
let program: SceneProgram | null = null;
let lastHeartbeat = 0;

function disableCapability(name: string, value: unknown): void {
  try {
    Object.defineProperty(globalThis, name, { configurable: false, enumerable: false, writable: false, value });
  } catch {
    // A missing/non-configurable browser API is already unavailable.
  }
}

const blockedNetwork = () => Promise.reject(new Error('Network access is disabled in Three.js previews.'));
class BlockedNetworkApi {
  constructor() {
    throw new Error('Network access is disabled in Three.js previews.');
  }
}
class BlockedDynamicCode {
  constructor() {
    throw new Error('Dynamic code evaluation is disabled in Three.js previews.');
  }
}

disableCapability('fetch', blockedNetwork);
disableCapability('XMLHttpRequest', BlockedNetworkApi);
disableCapability('WebSocket', BlockedNetworkApi);
disableCapability('EventSource', BlockedNetworkApi);
disableCapability('importScripts', BlockedNetworkApi);
disableCapability('indexedDB', undefined);
disableCapability('caches', undefined);
disableCapability('eval', BlockedDynamicCode);
disableCapability('Function', BlockedDynamicCode);
for (const prototype of [
  Function.prototype,
  Object.getPrototypeOf(async () => {}),
  Object.getPrototypeOf(function* () {}),
  Object.getPrototypeOf(async function* () {}),
]) {
  try {
    Object.defineProperty(prototype, 'constructor', {
      configurable: false,
      writable: false,
      value: BlockedDynamicCode,
    });
  } catch {
    // A locked constructor is already unavailable to author source.
  }
}

function errorLocation(error: unknown): Pick<ThreeSceneError, 'line' | 'column'> {
  const stack = error instanceof Error ? (error.stack ?? '') : '';
  const match = /three-scene\.js:(\d+):(\d+)/u.exec(stack);
  const rawLine = Number(match?.[1]);
  const column = Number(match?.[2]);
  // The Function constructor adds two wrapper lines before author source.
  const line = Number.isInteger(rawLine) && rawLine > 2 ? rawLine - 2 : undefined;
  return {
    ...(line ? { line } : {}),
    ...(Number.isInteger(column) && column > 0 ? { column } : {}),
  };
}

function reportError(error: unknown, kind: ThreeSceneErrorKind): void {
  const raw = error instanceof Error ? error.message : String(error);
  runtime.postMessage({
    type: 'error',
    error: {
      kind,
      message: raw
        .replaceAll(/(?:https?|blob):\/\/\S+/gu, '[resource]')
        .replaceAll(/\s+/gu, ' ')
        .trim()
        .slice(0, 500),
      ...errorLocation(error),
    } satisfies ThreeSceneError,
  });
}

function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    if (value && typeof value === 'object' && 'isTexture' in value && 'dispose' in value) {
      (value as THREE.Texture).dispose();
    }
  }
  material.dispose();
}

function cleanup(): void {
  if (frameTimer) {
    clearTimeout(frameTimer);
  }
  frameTimer = null;
  try {
    program?.dispose?.();
  } catch {
    // Cleanup remains best-effort; the worker is discarded immediately after.
  }
  scene?.traverse((object) => {
    const candidate = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    candidate.geometry?.dispose();
    if (Array.isArray(candidate.material)) {
      candidate.material.forEach(disposeMaterial);
    } else if (candidate.material) {
      disposeMaterial(candidate.material);
    }
  });
  renderer?.dispose();
  renderer?.forceContextLoss();
  renderer = null;
  scene = null;
  camera = null;
  program = null;
}

function runFrame(time: number): void {
  if (!renderer || !scene || !camera || !program) {
    return;
  }
  try {
    program.frame?.(time);
    renderer.render(scene, camera);
    if (time - lastHeartbeat > 250) {
      runtime.postMessage({ type: 'heartbeat' });
      lastHeartbeat = time;
    }
    frameTimer = setTimeout(() => runFrame(performance.now()), 16);
  } catch (error) {
    cleanup();
    reportError(error, 'runtime');
  }
}

function start({ source, canvas }: WorkerStartMessage): void {
  cleanup();
  try {
    scene = new THREE.Scene();
    const nextCamera = new THREE.PerspectiveCamera(
      60,
      Math.max(1, canvas.width) / Math.max(1, canvas.height),
      0.1,
      2_000,
    );
    camera = nextCamera;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(1);
    renderer.setSize(Math.max(1, canvas.width), Math.max(1, canvas.height), false);
    const compile = new SourceFunction(
      'THREE',
      'scene',
      'camera',
      'renderer',
      'canvas',
      `"use strict";\n${source}\n//# sourceURL=three-scene.js\nreturn { frame: typeof frame === "function" ? frame : undefined, dispose: typeof dispose === "function" ? dispose : undefined };`,
    ) as (
      three: typeof THREE,
      scene: THREE.Scene,
      camera: THREE.Camera,
      renderer: THREE.WebGLRenderer,
      canvas: OffscreenCanvas,
    ) => SceneProgram;
    program = compile(THREE, scene, nextCamera, renderer, canvas);
    runtime.postMessage({ type: 'ready' });
    lastHeartbeat = 0;
    runFrame(performance.now());
  } catch (error) {
    cleanup();
    reportError(error, error instanceof SyntaxError ? 'compile' : 'runtime');
  }
}

runtime.onmessage = (event) => {
  if (event.data.type === 'start') {
    start(event.data);
  } else {
    cleanup();
    runtime.postMessage({ type: 'stopped' });
  }
};
