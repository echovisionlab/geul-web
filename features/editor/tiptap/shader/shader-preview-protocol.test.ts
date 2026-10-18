import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHADER_PROGRAM } from './shader-program';
import { DEFAULT_SHADER_FRAGMENT_SOURCE } from './shader-source';
import { createShaderPreviewWorkerRuntime, shaderContainedSize } from './shader-preview-runtime';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function programWithImage(fragmentSource = DEFAULT_SHADER_FRAGMENT_SOURCE) {
  return {
    ...DEFAULT_SHADER_PROGRAM,
    sources: { ...DEFAULT_SHADER_PROGRAM.sources, image: fragmentSource },
    channels: Object.fromEntries(
      ['bufferA', 'bufferB', 'bufferC', 'bufferD', 'cubemap', 'sound', 'image'].map((stage) => [
        stage,
        [{ kind: 'none' }, { kind: 'none' }, { kind: 'none' }, { kind: 'none' }],
      ]),
    ),
  } as typeof DEFAULT_SHADER_PROGRAM;
}

describe('Shader preview worker protocol', () => {
  it('contains the 16:9 drawing buffer inside wide and narrow durable preview surfaces', () => {
    expect(shaderContainedSize(900, 320)).toEqual({ width: 569, height: 320 });
    expect(shaderContainedSize(400, 320)).toEqual({ width: 400, height: 225 });
  });

  it('transfers one OffscreenCanvas, forwards pointer state and terminates on stop/dispose', () => {
    vi.useFakeTimers();
    const instances: FakeWorker[] = [];
    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage = vi.fn();
      terminate = vi.fn();
      constructor() {
        instances.push(this);
      }
    }
    vi.stubGlobal('Worker', FakeWorker);
    const offscreen = {} as OffscreenCanvas;
    const canvas = {
      width: 0,
      height: 0,
      transferControlToOffscreen: () => offscreen,
      getBoundingClientRect: () => ({ width: 640, height: 360 }),
    } as unknown as HTMLCanvasElement;
    const events = { onReady: vi.fn(), onStopped: vi.fn(), onError: vi.fn() };
    const runtime = createShaderPreviewWorkerRuntime(canvas, events);
    runtime.run(programWithImage());
    expect(instances).toHaveLength(1);
    expect(instances[0]!.postMessage).toHaveBeenCalledWith(
      {
        type: 'start',
        program: programWithImage(),
        audioEnabled: false,
        canvas: offscreen,
      },
      [offscreen],
    );
    instances[0]!.onmessage?.(new MessageEvent('message', { data: { type: 'ready' } }));
    expect(events.onReady).toHaveBeenCalledOnce();
    runtime.pointer(12, 34, true);
    expect(instances[0]!.postMessage).toHaveBeenLastCalledWith({ type: 'pointer', x: 12, y: 34, pressed: true });
    runtime.resize(800, 450);
    expect(instances[0]!.postMessage).toHaveBeenLastCalledWith({ type: 'resize', width: 800, height: 450 });
    runtime.stop();
    expect(instances[0]!.postMessage).toHaveBeenLastCalledWith({ type: 'stop' });
    vi.advanceTimersByTime(100);
    expect(instances[0]!.terminate).toHaveBeenCalledOnce();
    expect(events.onStopped).toHaveBeenCalledOnce();
    runtime.dispose();
  });
});
