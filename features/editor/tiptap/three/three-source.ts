export const THREE_SCENE_RUNTIME_IMPORT = "import * as THREE from 'three';";

export const DEFAULT_THREE_SCENE_SOURCE = `${THREE_SCENE_RUNTIME_IMPORT}

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshNormalMaterial();
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);
camera.position.z = 3;

function frame(time: number) {
  cube.rotation.x = time * 0.0004;
  cube.rotation.y = time * 0.0007;
}`;

export const THREE_SCENE_MAX_SOURCE_LENGTH = 100_000;

const THREE_SCENE_RUNTIME_IMPORT_PATTERN = /^import\s+\*\s+as\s+THREE\s+from\s+['"]three['"];[ \t]*(?:\r?\n|$)/u;

/** Removes only the editor's visible virtual Three.js import while preserving source line numbers. */
export function stripThreeSceneRuntimeImport(source: string): string {
  return source.replace(THREE_SCENE_RUNTIME_IMPORT_PATTERN, (match) =>
    match.endsWith('\r\n') ? '\r\n' : match.endsWith('\n') ? '\n' : '',
  );
}

export const THREE_SCENE_MONACO_MODULE_TYPES = `declare const THREE: any;
export = THREE;
`;

export const THREE_SCENE_MONACO_GLOBAL_TYPES = `declare const scene: any;
declare const camera: any;
declare const renderer: any;
declare const canvas: OffscreenCanvas;
`;

export type ThreeSceneErrorKind = 'compile' | 'runtime' | 'policy' | 'resource';

export interface ThreeSceneError {
  kind: ThreeSceneErrorKind;
  message: string;
  line?: number;
  column?: number;
}

const FORBIDDEN_SOURCE_PATTERNS: readonly { pattern: RegExp; message: string }[] = [
  {
    pattern: /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|importScripts|sendBeacon)\b/u,
    message: 'Network APIs are not available in a Three.js scene.',
  },
  { pattern: /\b(?:import|export)\b/u, message: 'Modules are not available in a Three.js scene.' },
  { pattern: /\b(?:eval|Function)\s*\(/u, message: 'Dynamic code evaluation is not available in a Three.js scene.' },
  { pattern: /\.\s*constructor\b/u, message: 'Constructor reflection is not available in a Three.js scene.' },
  {
    pattern: /\b(?:window|document|localStorage|sessionStorage|indexedDB)\b/u,
    message: 'Page and browser storage APIs are not available in a Three.js scene.',
  },
] as const;

/**
 * A fail-closed preflight for the worker runtime. This is intentionally not a
 * JavaScript security parser: the dedicated worker and its disabled globals
 * remain the execution boundary. The preflight gives authors an immediate,
 * source-preserving policy error before any worker is created.
 */
export function validateThreeSceneSource(source: string): ThreeSceneError | null {
  if (source.length > THREE_SCENE_MAX_SOURCE_LENGTH) {
    return {
      kind: 'resource',
      message: `Three.js source exceeds the ${THREE_SCENE_MAX_SOURCE_LENGTH.toLocaleString('en-US')} character limit.`,
    };
  }
  const executableSource = stripThreeSceneRuntimeImport(source);
  for (const entry of FORBIDDEN_SOURCE_PATTERNS) {
    const match = entry.pattern.exec(executableSource);
    if (!match || match.index === undefined) {
      continue;
    }
    const before = executableSource.slice(0, match.index);
    const lines = before.split('\n');
    return {
      kind: 'policy',
      message: entry.message,
      line: lines.length,
      column: (lines.at(-1)?.length ?? 0) + 1,
    };
  }
  return null;
}

const STACK_LOCATION = /(?:three-scene\.js|<anonymous>):(\d+):(\d+)/u;

/** Removes URLs/stacks from runtime output while retaining useful source location. */
export function normalizeThreeSceneError(
  input: unknown,
  kind: ThreeSceneErrorKind,
  sourceLineOffset = 0,
): ThreeSceneError {
  const rawMessage =
    input instanceof Error ? input.message : typeof input === 'string' ? input : 'Unknown Three.js scene error';
  const message = rawMessage
    .replaceAll(/(?:https?|blob):\/\/\S+/gu, '[resource]')
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .slice(0, 500);
  const stack = input instanceof Error ? (input.stack ?? '') : '';
  const location = STACK_LOCATION.exec(stack);
  const parsedLine = Number(location?.[1]);
  const parsedColumn = Number(location?.[2]);
  return {
    kind,
    message: message || 'Unknown Three.js scene error',
    ...(Number.isInteger(parsedLine) && parsedLine > sourceLineOffset ? { line: parsedLine - sourceLineOffset } : {}),
    ...(Number.isInteger(parsedColumn) && parsedColumn > 0 ? { column: parsedColumn } : {}),
  };
}
