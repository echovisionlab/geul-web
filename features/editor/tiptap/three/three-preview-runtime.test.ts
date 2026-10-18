import { createThreePreviewWorkerRuntime } from './three-preview-runtime';

it('transpiles durable TypeScript before starting the isolated preview worker', () => {
  const workers: Array<{
    name: string;
    onmessage: ((event: MessageEvent) => void) | null;
    postMessage: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
  }> = [];
  class FakeWorker {
    name: string;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();

    constructor(_url: URL, options?: WorkerOptions) {
      this.name = options?.name ?? '';
      workers.push(this);
    }
  }
  vi.stubGlobal('Worker', FakeWorker);
  const offscreen = {} as OffscreenCanvas;
  // The runtime reads only the canvas bounds and size before transferring control to the worker.
  const canvas = {
    width: 0,
    height: 0,
    getBoundingClientRect: () => ({ width: 0, height: 0 }),
    transferControlToOffscreen: () => offscreen,
  } as unknown as HTMLCanvasElement;
  const onReady = vi.fn();
  const runtime = createThreePreviewWorkerRuntime(canvas, {
    onReady,
    onStopped: vi.fn(),
    onError: vi.fn(),
  });
  const typescriptSource = 'function frame(time: number) { camera.position.z = time; }';

  runtime.run(typescriptSource);
  const transpiler = workers.find((worker) => worker.name === 'three-scene-transpile');
  expect(transpiler?.postMessage).toHaveBeenCalledWith({ type: 'transpile', source: typescriptSource });
  transpiler?.onmessage?.(
    new MessageEvent('message', {
      data: { type: 'compiled', source: 'function frame(time) { camera.position.z = time; }' },
    }),
  );
  const preview = workers.find((worker) => worker.name === 'three-scene-preview');
  expect(preview?.postMessage).toHaveBeenCalledWith(
    {
      type: 'start',
      source: 'function frame(time) { camera.position.z = time; }',
      canvas: offscreen,
    },
    [offscreen],
  );
  preview?.onmessage?.(new MessageEvent('message', { data: { type: 'ready' } }));
  expect(onReady).toHaveBeenCalledOnce();

  runtime.dispose();
  vi.unstubAllGlobals();
});
