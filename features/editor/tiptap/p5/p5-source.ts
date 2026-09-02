import { P5_CAPABILITIES, type P5Capability } from './p5-capabilities';

export const DEFAULT_P5_SKETCH_SOURCE = `function setup() {
  createCanvas(640, 360);
}

function draw() {
  background(18, 20, 24);
  noStroke();
  fill(74, 144, 245);
  const pointerIsInside = mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height;
  circle(pointerIsInside ? mouseX : width / 2, pointerIsInside ? mouseY : height / 2, 72);
}`;

export type P5SketchErrorKind = 'compile' | 'runtime' | 'policy' | 'resource' | 'permission';

export interface P5SketchError {
  kind: P5SketchErrorKind;
  message: string;
  line?: number;
  column?: number;
}

const CAPABILITY_PATTERNS: Record<P5Capability, readonly RegExp[]> = {
  camera: [/\bcreateCapture\s*\(\s*(?:VIDEO|\{[^)]*\bvideo\s*:\s*(?:true|\{))/su, /\bcreateCapture\s*\(\s*\)/su],
  microphone: [/\bcreateCapture\s*\(\s*(?:AUDIO|\{[^)]*\baudio\s*:\s*(?:true|\{))/su],
  motion: [
    /\b(?:requestMotionPermission|deviceMoved|deviceTurned|deviceShaken)\s*\(/u,
    /\b(?:acceleration[XYZ]|rotation[XYZ])\b/u,
  ],
  midi: [/\brequestMIDIAccess\s*\(/u],
  gamepad: [/\bgetGamepads\s*\(/u],
  serial: [/\b(?:requestSerialPort|getSerialPorts)\s*\(/u],
  location: [/\brequestCurrentPosition\s*\(/u],
  bluetooth: [/\brequestBluetoothDevice\s*\(/u],
};

export function detectP5Capabilities(source: string): P5Capability[] {
  return P5_CAPABILITIES.filter((capability) =>
    CAPABILITY_PATTERNS[capability].some((pattern) => pattern.test(source)),
  );
}

const FORBIDDEN_SOURCE_PATTERNS: readonly { pattern: RegExp; message: string }[] = [
  {
    pattern: /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\b/u,
    message: 'Network APIs are not available in a p5.js sketch.',
  },
  {
    pattern:
      /\b(?:loadImage|loadJSON|loadStrings|loadTable|loadXML|loadBytes|loadFont|loadSound|httpGet|httpPost|httpDo)\s*\(/u,
    message: 'Remote p5.js loaders are not available in a sketch preview.',
  },
  {
    pattern: /\bimport\s*(?:\(|[\s{*])/u,
    message: 'Imports are not available in a p5.js sketch.',
  },
  {
    pattern: /\b(?:eval|Function)\s*\(/u,
    message: 'Dynamic code evaluation is not available in a p5.js sketch.',
  },
  {
    pattern: /\.\s*constructor\b/u,
    message: 'Constructor reflection is not available in a p5.js sketch.',
  },
  {
    pattern:
      /\b(?:window|document|globalThis|self|parent|top|opener|location|navigator|localStorage|sessionStorage|indexedDB|caches)\b/u,
    message: 'Page and browser storage APIs are not available in a p5.js sketch.',
  },
  {
    pattern: /\b(?:setTimeout|setInterval|requestAnimationFrame|queueMicrotask|Promise)\b/u,
    message: 'Sketch-owned schedulers are not available; use p5.js draw for animation.',
  },
] as const;

/**
 * Rejects capabilities that the disposable preview intentionally does not
 * grant. The worker/opaque iframe remain the execution boundary; this check is
 * an author-facing error with a useful source location.
 */
export function validateP5SketchSource(
  source: string,
  capabilities: readonly P5Capability[] = [],
): P5SketchError | null {
  for (const entry of FORBIDDEN_SOURCE_PATTERNS) {
    const match = entry.pattern.exec(source);
    if (!match || match.index === undefined) {
      continue;
    }
    const lines = source.slice(0, match.index).split('\n');
    return {
      kind: 'policy',
      message: entry.message,
      line: lines.length,
      column: (lines.at(-1)?.length ?? 0) + 1,
    };
  }
  const missingCapability = detectP5Capabilities(source).find((capability) => !capabilities.includes(capability));
  if (missingCapability) {
    const pattern = CAPABILITY_PATTERNS[missingCapability].find((candidate) => candidate.test(source));
    const match = pattern?.exec(source);
    const index = match?.index ?? 0;
    const lines = source.slice(0, index).split('\n');
    return {
      kind: 'policy',
      message: `The ${missingCapability} capability must be declared in the p5.js block settings before it can run.`,
      line: lines.length,
      column: (lines.at(-1)?.length ?? 0) + 1,
    };
  }
  return null;
}

const STACK_LOCATION = /(?:p5-sketch\.js|<anonymous>):(\d+):(\d+)/u;

/** Removes resource URLs/stacks while retaining the author source location. */
export function normalizeP5SketchError(input: unknown, kind: P5SketchErrorKind, sourceLineOffset = 0): P5SketchError {
  const rawMessage =
    input instanceof Error ? input.message : typeof input === 'string' ? input : 'Unknown p5.js sketch error';
  const message = rawMessage
    .replaceAll(/(?:https?|blob|file):\/\/\S+/gu, '[resource]')
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .slice(0, 500);
  const stack = input instanceof Error ? (input.stack ?? '') : '';
  const location = STACK_LOCATION.exec(stack);
  const parsedLine = Number(location?.[1]);
  const parsedColumn = Number(location?.[2]);
  return {
    kind,
    message: message || 'Unknown p5.js sketch error',
    ...(Number.isInteger(parsedLine) && parsedLine > sourceLineOffset ? { line: parsedLine - sourceLineOffset } : {}),
    ...(Number.isInteger(parsedColumn) && parsedColumn > 0 ? { column: parsedColumn } : {}),
  };
}
