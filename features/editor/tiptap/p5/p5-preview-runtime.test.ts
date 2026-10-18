// @vitest-environment jsdom

import { createP5PreviewRuntime } from './p5-preview-runtime';
import { DEFAULT_P5_SKETCH_SOURCE } from './p5-source';

describe('p5.js device runner contract', () => {
  afterEach(() => {
    delete document.documentElement.dataset.geulP5RunnerUrl;
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses the isolated runner without same-origin sandbox authority and sends source only after ready', () => {
    vi.useFakeTimers();
    document.documentElement.dataset.geulP5RunnerUrl = 'https://runtime.example.run/tools/p5-runner';
    const channel = '00000000-0000-4000-8000-000000000000';
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(channel);
    const workers: Array<{
      onmessage: ((event: MessageEvent) => void) | null;
      postMessage: ReturnType<typeof vi.fn>;
    }> = [];
    class ReadyWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn();
      terminate = vi.fn();

      constructor() {
        workers.push(this);
      }
    }
    vi.stubGlobal('Worker', ReadyWorker);
    const mount = document.createElement('div');
    document.body.append(mount);
    const runtime = createP5PreviewRuntime(mount, {
      onReady: vi.fn(),
      onStopped: vi.fn(),
      onError: vi.fn(),
    });
    const source = 'function setup() { createCanvas(10, 10); createCapture(AUDIO); }';
    runtime.run(source, {
      capabilities: ['microphone'],
    });
    workers[0]?.onmessage?.(new MessageEvent('message', { data: { type: 'initialized' } }));
    workers[0]?.onmessage?.(new MessageEvent('message', { data: { type: 'ready' } }));

    const frame = mount.querySelector<HTMLIFrameElement>('iframe');
    const runnerOrigin = 'https://runtime.example.run';
    expect(frame).not.toBeNull();
    expect(frame?.hasAttribute('sandbox')).toBe(false);
    expect(frame?.outerHTML).not.toContain('allow-same-origin');
    expect(frame?.getAttribute('allow')).toBe(`microphone ${runnerOrigin}`);
    expect(frame?.src).toBe(`${runnerOrigin}/tools/p5-runner#channel=${channel}`);
    expect(frame?.srcdoc).toBe('');
    expect(frame?.outerHTML).not.toContain(source);

    const postMessage = vi.spyOn(frame!.contentWindow!, 'postMessage');
    globalThis.dispatchEvent(
      new MessageEvent('message', {
        data: { channel, type: 'runner-ready' },
        origin: runnerOrigin,
        source: frame!.contentWindow,
      }),
    );
    expect(postMessage).toHaveBeenCalledWith(
      { channel, type: 'init', source, capabilities: ['microphone'] },
      runnerOrigin,
    );
    runtime.dispose();
    mount.remove();
  });

  it('delegates only declared location and Bluetooth permissions to the isolated runner', () => {
    vi.useFakeTimers();
    document.documentElement.dataset.geulP5RunnerUrl = 'https://runtime.example.run/tools/p5-runner';
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    const workers: Array<{
      onmessage: ((event: MessageEvent) => void) | null;
    }> = [];
    class ReadyWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn();
      terminate = vi.fn();

      constructor() {
        workers.push(this);
      }
    }
    vi.stubGlobal('Worker', ReadyWorker);
    const mount = document.createElement('div');
    document.body.append(mount);
    const runtime = createP5PreviewRuntime(mount, {
      onReady: vi.fn(),
      onStopped: vi.fn(),
      onError: vi.fn(),
    });
    runtime.run(
      'function mousePressed() { requestCurrentPosition(); requestBluetoothDevice({ acceptAllDevices: true }); }',
      { capabilities: ['location', 'bluetooth'] },
    );
    workers[0]?.onmessage?.(new MessageEvent('message', { data: { type: 'initialized' } }));
    workers[0]?.onmessage?.(new MessageEvent('message', { data: { type: 'ready' } }));

    const frame = mount.querySelector<HTMLIFrameElement>('iframe');
    expect(frame?.getAttribute('allow')).toBe(
      'geolocation https://runtime.example.run; bluetooth https://runtime.example.run',
    );
    expect(frame?.getAttribute('allow')).not.toContain('camera');
    expect(frame?.getAttribute('allow')).not.toContain('microphone');
    runtime.dispose();
    mount.remove();
  });

  it('fails closed before preflight when the configured runner is same-origin', () => {
    document.documentElement.dataset.geulP5RunnerUrl = `${globalThis.location.origin}/tools/p5-runner`;
    const onError = vi.fn();
    const worker = vi.fn();
    vi.stubGlobal('Worker', worker);
    const mount = document.createElement('div');
    const runtime = createP5PreviewRuntime(mount, {
      onReady: vi.fn(),
      onStopped: vi.fn(),
      onError,
    });

    runtime.run('function setup() { createCanvas(10, 10); createCapture(AUDIO); }', {
      capabilities: ['microphone'],
    });

    expect(worker).not.toHaveBeenCalled();
    expect(mount.querySelector('iframe')).toBeNull();
    expect(onError).toHaveBeenCalledWith({
      kind: 'resource',
      message: 'Device-enabled p5.js previews require a configured isolated runner origin.',
    });
    runtime.dispose();
  });

  it('terminates a preflight that exceeds the CPU budget before mounting a frame', () => {
    vi.useFakeTimers();
    const terminate = vi.fn();
    const pendingWorkers: PendingWorker[] = [];
    class PendingWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn();
      terminate = terminate;

      constructor() {
        pendingWorkers.push(this);
      }
    }
    vi.stubGlobal('Worker', PendingWorker);
    const mount = document.createElement('div');
    const onError = vi.fn();
    const runtime = createP5PreviewRuntime(mount, {
      onReady: vi.fn(),
      onStopped: vi.fn(),
      onError,
    });
    runtime.run('while (true) {}');
    const pendingWorker = pendingWorkers[0];
    expect(pendingWorker).toBeDefined();
    pendingWorker?.onmessage?.(new MessageEvent('message', { data: { type: 'initialized' } }));
    vi.advanceTimersByTime(751);
    expect(terminate).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'resource', message: expect.stringContaining('CPU budget') }),
    );
    expect(mount.querySelector('iframe')).toBeNull();
    runtime.dispose();
  });

  it('does not charge worker startup time to the author setup CPU budget', () => {
    vi.useFakeTimers();
    const pendingWorkers: PendingWorker[] = [];
    class PendingWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn();
      terminate = vi.fn();

      constructor() {
        pendingWorkers.push(this);
      }
    }
    vi.stubGlobal('Worker', PendingWorker);
    const onError = vi.fn();
    const runtime = createP5PreviewRuntime(document.createElement('div'), {
      onReady: vi.fn(),
      onStopped: vi.fn(),
      onError,
    });
    runtime.run(DEFAULT_P5_SKETCH_SOURCE);
    const pendingWorker = pendingWorkers[0];
    expect(pendingWorker).toBeDefined();

    vi.advanceTimersByTime(751);
    expect(onError).not.toHaveBeenCalled();
    pendingWorker?.onmessage?.(new MessageEvent('message', { data: { type: 'initialized' } }));
    expect(pendingWorker?.postMessage).toHaveBeenCalledWith({
      type: 'preflight',
      source: DEFAULT_P5_SKETCH_SOURCE,
    });
    vi.advanceTimersByTime(751);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('CPU budget') }));

    runtime.dispose();
  });
});
