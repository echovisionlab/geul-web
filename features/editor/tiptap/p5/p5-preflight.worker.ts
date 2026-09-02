import type { P5SketchError } from './p5-source';

type PreflightRequest = { type: 'preflight'; source: string };

const runtime = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<PreflightRequest>) => void) | null;
  postMessage: (message: unknown) => void;
};

const callableStub: unknown = new Proxy(() => 0, {
  apply: () => callableStub,
  construct: () => callableStub as object,
  get: (_target, property) => {
    if (property === Symbol.toPrimitive) {
      return () => 0;
    }
    if (property === 'valueOf') {
      return () => 0;
    }
    if (property === 'toString') {
      return () => '';
    }
    return callableStub;
  },
});

const BUILT_INS: Record<string, unknown> = {
  Array,
  BigInt,
  Boolean,
  Date,
  Error,
  JSON,
  Map,
  Math,
  Number,
  Object,
  Promise,
  RegExp,
  Set,
  String,
  Symbol,
  Uint8Array,
  parseFloat,
  parseInt,
};

const p5Scope = new Proxy<Record<string, unknown>>(BUILT_INS, {
  has: () => true,
  get: (target, property) => {
    if (property === Symbol.unscopables) {
      return undefined;
    }
    if (typeof property === 'string' && property in target) {
      return target[property];
    }
    return callableStub;
  },
});

function errorLocation(error: unknown): Pick<P5SketchError, 'line' | 'column'> {
  const stack = error instanceof Error ? (error.stack ?? '') : '';
  const match = /p5-sketch\.js:(\d+):(\d+)/u.exec(stack);
  const rawLine = Number(match?.[1]);
  const column = Number(match?.[2]);
  // Function adds two wrapper lines before the source body.
  const line = Number.isInteger(rawLine) && rawLine > 2 ? rawLine - 2 : undefined;
  return {
    ...(line ? { line } : {}),
    ...(Number.isInteger(column) && column > 0 ? { column } : {}),
  };
}

runtime.onmessage = (event) => {
  if (event.data.type !== 'preflight') {
    return;
  }
  try {
    const compile = new Function(
      'scope',
      `with (scope) {\n${event.data.source}\n//# sourceURL=p5-sketch.js\nreturn { setup: typeof setup === "function" ? setup : undefined, draw: typeof draw === "function" ? draw : undefined };\n}`,
    ) as (scope: Record<string, unknown>) => { setup?: () => void; draw?: () => void };
    const program = compile(p5Scope);
    program.setup?.();
    // Exercise more than the first frame so delayed accidental infinite loops
    // fail inside the disposable worker before the visual iframe is mounted.
    for (let frameCount = 1; frameCount <= 240; frameCount += 1) {
      BUILT_INS.frameCount = frameCount;
      program.draw?.();
    }
    runtime.postMessage({ type: 'ready' });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    runtime.postMessage({
      type: 'error',
      error: {
        kind: error instanceof SyntaxError ? 'compile' : 'runtime',
        message: raw.replaceAll(/(?:https?|blob|file):\/\/\S+/gu, '[resource]').slice(0, 500),
        ...errorLocation(error),
      } satisfies P5SketchError,
    });
  }
};

// Signal only after this module and its message handler are ready. The host
// starts the author-code CPU budget from this point, not from worker download
// and module evaluation time.
runtime.postMessage({ type: 'initialized' });
