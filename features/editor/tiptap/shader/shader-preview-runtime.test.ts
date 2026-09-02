// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShaderPreviewWorkerRuntime, SHADER_START_TIMEOUT_MS } from './shader-preview-runtime';
import { DEFAULT_SHADER_PROGRAM } from './shader-program';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
}

function canvas() {
  const element = document.createElement('canvas');
  Object.defineProperty(element, 'transferControlToOffscreen', { value: () => ({}) });
  element.getBoundingClientRect = () => ({
    width: 640,
    height: 360,
    top: 0,
    left: 0,
    right: 640,
    bottom: 360,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return element;
}

afterEach(() => {
  FakeWorker.instances = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Shader main-thread runtime protocol', () => {
  it('starts exact multipass program, forwards resize and terminates cleanly', () => {
    vi.stubGlobal('Worker', FakeWorker);
    const runtime = createShaderPreviewWorkerRuntime(canvas(), {
      onReady: vi.fn(),
      onStopped: vi.fn(),
      onError: vi.fn(),
    });
    runtime.run(DEFAULT_SHADER_PROGRAM);
    const worker = FakeWorker.instances[0]!;
    expect(worker.postMessage.mock.calls[0]?.[0]).toMatchObject({
      type: 'start',
      program: DEFAULT_SHADER_PROGRAM,
      audioEnabled: false,
    });
    runtime.resize(800, 450);
    expect(worker.postMessage).toHaveBeenLastCalledWith({ type: 'resize', width: 800, height: 450 });
    runtime.dispose();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('allows expensive multipass compilation for eight seconds before the start watchdog terminates it', () => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', FakeWorker);
    const onError = vi.fn();
    const runtime = createShaderPreviewWorkerRuntime(canvas(), {
      onReady: vi.fn(),
      onStopped: vi.fn(),
      onError,
    });
    runtime.run(DEFAULT_SHADER_PROGRAM);
    vi.advanceTimersByTime(SHADER_START_TIMEOUT_MS - 1);
    expect(onError).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onError).toHaveBeenCalledWith({
      kind: 'resource',
      message: 'The shader preview did not start in time and was terminated.',
    });
    vi.useRealTimers();
  });

  it('resolves image, video and six cubemap File assets and sends transferable frames', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const bitmap = () => ({ width: 2, height: 2, close: vi.fn() }) as unknown as ImageBitmap;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => new Blob() })),
    );
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap()),
    );
    const program = {
      ...DEFAULT_SHADER_PROGRAM,
      channels: {
        image: [
          {
            kind: 'textureFile' as const,
            fileId: 'image',
            sampler: { filter: 'linear' as const, wrap: 'clamp' as const, vflip: false },
          },
          {
            kind: 'videoFile' as const,
            fileId: 'video',
            sampler: { filter: 'linear' as const, wrap: 'clamp' as const, vflip: false },
          },
          {
            kind: 'cubemapFiles' as const,
            fileIds: ['px', 'nx', 'py', 'ny', 'pz', 'nz'] as [string, string, string, string, string, string],
            sampler: { filter: 'linear' as const, wrap: 'clamp' as const, vflip: false },
          },
        ],
      },
    };
    const targetCanvas = canvas();
    const originalCreateElement = document.createElement.bind(document);
    const video = originalCreateElement('video');
    Object.defineProperty(video, 'videoWidth', { value: 320 });
    Object.defineProperty(video, 'videoHeight', { value: 180 });
    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    Object.defineProperty(video, 'play', { value: vi.fn(async () => undefined), configurable: true });
    Object.defineProperty(video, 'pause', { value: vi.fn(), configurable: true });
    Object.defineProperty(video, 'load', { value: vi.fn(), configurable: true });
    const cancelVideoFrameCallback = vi.fn();
    let frameCallback: (() => void) | undefined;
    Object.defineProperty(video, 'requestVideoFrameCallback', {
      value: vi.fn((callback: () => void) => {
        frameCallback = callback;
        return 7;
      }),
    });
    Object.defineProperty(video, 'cancelVideoFrameCallback', { value: cancelVideoFrameCallback });
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      tag === 'video' ? video : originalCreateElement(tag)) as typeof document.createElement);
    const runtime = createShaderPreviewWorkerRuntime(targetCanvas, {
      onReady: vi.fn(),
      onStopped: vi.fn(),
      onError: vi.fn(),
    });
    runtime.run(program, { resolveAsset: async (fileId, kind) => ({ fileId, kind, url: `https://media/${fileId}` }) });
    await vi.waitFor(() =>
      expect(FakeWorker.instances[0]!.postMessage.mock.calls.some(([message]) => message.type === 'asset2d')).toBe(
        true,
      ),
    );
    await vi.waitFor(() =>
      expect(
        FakeWorker.instances[0]!.postMessage.mock.calls.some(
          ([message]) => message.type === 'assetCube' && message.faces.length === 6,
        ),
      ).toBe(true),
    );
    video.dispatchEvent(new Event('loadeddata'));
    await vi.waitFor(() => expect(frameCallback).toBeDefined());
    frameCallback?.();
    await vi.waitFor(() =>
      expect(
        FakeWorker.instances[0]!.postMessage.mock.calls.some(
          ([message]) => message.type === 'assetVideo' && message.time === 0,
        ),
      ).toBe(true),
    );
    runtime.dispose();
    expect(cancelVideoFrameCallback).toHaveBeenCalledWith(7);
  });

  it('schedules worker PCM only after explicit audio enable and closes the context on stop', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const close = vi.fn(async () => undefined);
    const resume = vi.fn(async () => undefined);
    const left = new Float32Array(2);
    const right = new Float32Array(2);
    const start = vi.fn();
    const connect = vi.fn();
    const createBuffer = vi.fn(() => ({
      duration: 2 / 44_100,
      getChannelData: (channel: number) => (channel === 0 ? left : right),
    }));
    const createBufferSource = vi.fn(() => ({ buffer: null, connect, start }));
    vi.stubGlobal(
      'AudioContext',
      class {
        currentTime = 0;
        destination = {};
        close = close;
        resume = resume;
        createBuffer = createBuffer;
        createBufferSource = createBufferSource;
      },
    );
    const runtime = createShaderPreviewWorkerRuntime(canvas(), {
      onReady: vi.fn(),
      onStopped: vi.fn(),
      onError: vi.fn(),
    });
    runtime.run(DEFAULT_SHADER_PROGRAM);
    expect(close).not.toHaveBeenCalled();
    runtime.enableAudio();
    expect(resume).toHaveBeenCalledOnce();
    const worker = FakeWorker.instances[0]!;
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'enableAudio' });
    worker.onmessage?.({
      data: { type: 'audio', samples: new Float32Array([0.25, -0.25, 0.5, -0.5]), sampleRate: 44_100 },
    } as MessageEvent);
    expect(createBuffer).toHaveBeenCalledWith(2, 2, 44_100);
    expect(Array.from(left)).toEqual([0.25, 0.5]);
    expect(Array.from(right)).toEqual([-0.25, -0.5]);
    expect(connect).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledWith(0);
    runtime.dispose();
    expect(close).toHaveBeenCalledOnce();
  });

  it('terminates and reports a missing File resolver result instead of leaving a black live runtime', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const onError = vi.fn();
    const runtime = createShaderPreviewWorkerRuntime(canvas(), {
      onReady: vi.fn(),
      onStopped: vi.fn(),
      onError,
    });
    const program = {
      ...DEFAULT_SHADER_PROGRAM,
      channels: {
        image: [
          {
            kind: 'textureFile' as const,
            fileId: 'missing',
            sampler: { filter: 'linear' as const, wrap: 'clamp' as const, vflip: false },
          },
        ],
      },
    };
    runtime.run(program, { resolveAsset: async () => Promise.reject(new Error('missing')) });
    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith({
        kind: 'resource',
        message: 'Shader texture File missing is unavailable.',
      }),
    );
    expect(FakeWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
  });

  it('reports only the first failure when multiple File resolvers reject together', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const onError = vi.fn();
    const runtime = createShaderPreviewWorkerRuntime(canvas(), {
      onReady: vi.fn(),
      onStopped: vi.fn(),
      onError,
    });
    const sampler = { filter: 'linear' as const, wrap: 'clamp' as const, vflip: false };
    runtime.run(
      {
        ...DEFAULT_SHADER_PROGRAM,
        channels: {
          image: [
            { kind: 'textureFile', fileId: 'one', sampler },
            { kind: 'textureFile', fileId: 'two', sampler },
          ],
        },
      },
      { resolveAsset: async () => Promise.reject(new Error('missing')) },
    );
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('turns a rejected video frame decode into one terminal error without rescheduling the callback', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => Promise.reject(new Error('decode'))),
    );
    const originalCreateElement = document.createElement.bind(document);
    const video = originalCreateElement('video');
    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    Object.defineProperty(video, 'play', { value: vi.fn(async () => undefined), configurable: true });
    Object.defineProperty(video, 'pause', { value: vi.fn(), configurable: true });
    Object.defineProperty(video, 'load', { value: vi.fn(), configurable: true });
    let frameCallback: (() => void) | undefined;
    const requestVideoFrameCallback = vi.fn((callback: () => void) => {
      frameCallback = callback;
      return 4;
    });
    Object.defineProperty(video, 'requestVideoFrameCallback', { value: requestVideoFrameCallback });
    Object.defineProperty(video, 'cancelVideoFrameCallback', { value: vi.fn() });
    const createElement = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tag: string) =>
        tag === 'video' ? video : originalCreateElement(tag)) as typeof document.createElement);
    const onError = vi.fn();
    const runtime = createShaderPreviewWorkerRuntime(canvas(), {
      onReady: vi.fn(),
      onStopped: vi.fn(),
      onError,
    });
    runtime.run(
      {
        ...DEFAULT_SHADER_PROGRAM,
        channels: {
          image: [
            {
              kind: 'videoFile',
              fileId: 'broken-video',
              sampler: { filter: 'linear', wrap: 'clamp', vflip: false },
            },
          ],
        },
      },
      {
        resolveAsset: async (fileId, kind) => ({ fileId, kind, url: 'https://media/broken-video.mp4' }),
      },
    );
    await vi.waitFor(() => expect(createElement).toHaveBeenCalledWith('video'));
    video.dispatchEvent(new Event('loadeddata'));
    await vi.waitFor(() => expect(requestVideoFrameCallback).toHaveBeenCalledOnce());
    frameCallback?.();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(requestVideoFrameCallback).toHaveBeenCalledOnce();
  });

  it('validates every stage before allocating a worker and identifies the exact stage', () => {
    vi.stubGlobal('Worker', FakeWorker);
    const onError = vi.fn();
    const runtime = createShaderPreviewWorkerRuntime(canvas(), {
      onReady: vi.fn(),
      onStopped: vi.fn(),
      onError,
    });
    runtime.run({
      ...DEFAULT_SHADER_PROGRAM,
      sources: { ...DEFAULT_SHADER_PROGRAM.sources, sound: 'return vec2(0.0);' },
    });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'compile', stage: 'sound', message: expect.stringContaining('mainSound') }),
    );
    expect(FakeWorker.instances).toHaveLength(0);
  });
});
