import { buildSync } from 'esbuild';
import { createContext, runInContext } from 'node:vm';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

function workerFixture(mode: 'development' | 'production', initialization: Promise<void> = Promise.resolve()) {
  const diagnostics = Object.fromEntries(
    ['log', 'debug', 'info', 'warn', 'error', 'table', 'group', 'groupEnd'].map((name) => [name, vi.fn()]),
  );
  const postMessage = vi.fn();
  let threeConsole: (level: 'log' | 'warn' | 'error', message: string) => void;
  const renderers: Array<{
    debug: { checkShaderErrors: boolean; onShaderError: () => void };
    dispose: ReturnType<typeof vi.fn>;
  }> = [];
  const onShaderError = vi.fn();
  class Renderer {
    debug = { checkShaderErrors: true, onShaderError };
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    forceContextLoss = vi.fn();
    constructor() {
      renderers.push(this);
      threeConsole('log', 'Three diagnostic');
      threeConsole('warn', 'Three warning');
      threeConsole('error', 'Three error diagnostic');
    }
  }
  const code = buildSync({
    entryPoints: [resolve(__dirname, 'three-preview.worker.ts')],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'cjs',
    external: ['@/lib/three/cdn-runtime'],
    define: { 'process.env.NODE_ENV': JSON.stringify(mode) },
  }).outputFiles[0].text;
  const context = createContext({
    console: diagnostics,
    postMessage,
    performance: { now: () => 1 },
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
    require: () => ({
      loadThreeRuntime: async () => {
        await initialization;
        return {
          setConsoleFunction: (callback: typeof threeConsole) => {
            threeConsole = callback;
          },
          WebGLRenderer: Renderer,
          Scene: class {
            traverse() {}
          },
          PerspectiveCamera: class {},
        };
      },
    }),
  });
  runInContext('globalThis.self = globalThis;', context);
  runInContext(code, context);
  return {
    diagnostics,
    postMessage,
    renderers,
    onShaderError,
    start(source: string) {
      return context.onmessage({ data: { type: 'start', source, canvas: { width: 640, height: 360 } } });
    },
    stop() {
      return context.onmessage({ data: { type: 'stop' } });
    },
  };
}

describe('Three preview diagnostics', () => {
  it('reports CDN initialization failures as resource errors without running author code', async () => {
    const fixture = workerFixture('production', Promise.reject(new Error('CDN unavailable')));
    await fixture.start('throw new Error("author code ran");');
    expect(fixture.renderers).toHaveLength(0);
    expect(fixture.postMessage).toHaveBeenCalledWith({
      type: 'error',
      error: expect.objectContaining({ kind: 'resource' }),
    });
  });

  it('does not start a stopped preview when the CDN subsequently finishes loading', async () => {
    let resolve!: () => void;
    const fixture = workerFixture(
      'production',
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    const start = fixture.start('throw new Error("author code ran");');
    await fixture.stop();
    resolve();
    await start;
    expect(fixture.renderers).toHaveLength(0);
    expect(fixture.postMessage).toHaveBeenCalledWith({ type: 'stopped' });
    expect(fixture.postMessage).not.toHaveBeenCalledWith({ type: 'ready' });
  });

  it.each(['development', 'production'] as const)('gates Three and author diagnostics in %s', async (mode) => {
    const fixture = workerFixture(mode);
    await fixture.start(`
      console.log('author log'); console.debug('author debug'); console.info('author info');
      console.warn('author warning'); console.error('author error');
      console.table({ value: 1 }); console.group('author group'); console.groupEnd();
      globalThis.console.log('global author log'); self.console.warn('worker author warning');
    `);
    expect(fixture.postMessage).toHaveBeenCalledWith({ type: 'ready' });
    expect(fixture.renderers[0].debug.checkShaderErrors).toBe(mode === 'development');
    expect(fixture.renderers[0].debug.onShaderError).toBe(fixture.onShaderError);
    for (const method of Object.values(fixture.diagnostics)) {
      if (mode === 'development') {
        expect(method).toHaveBeenCalled();
      } else {
        expect(method).not.toHaveBeenCalled();
      }
    }
  });

  it.each(['development', 'production'] as const)('still reports thrown frame errors in %s', async (mode) => {
    const fixture = workerFixture(mode);
    await fixture.start("function frame() { throw new Error('frame failed'); }");
    expect(fixture.postMessage).toHaveBeenCalledWith({
      type: 'error',
      error: expect.objectContaining({ kind: 'runtime', message: 'frame failed' }),
    });
    expect(fixture.renderers[0].dispose).toHaveBeenCalledOnce();
  });

  it('still reports compile errors outside development', async () => {
    const fixture = workerFixture('production');
    await fixture.start('const = invalid;');
    expect(fixture.postMessage).toHaveBeenCalledWith({
      type: 'error',
      error: expect.objectContaining({ kind: 'compile' }),
    });
  });
});
