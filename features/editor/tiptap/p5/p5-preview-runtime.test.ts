// @vitest-environment jsdom

import { createP5PreviewRuntime } from './p5-preview-runtime';
import { buildP5SandboxDocument } from './p5-preview-document';
import { DEFAULT_P5_SKETCH_SOURCE } from './p5-source';

describe('p5.js sandbox render readiness', () => {
  it('keeps the default sketch visibly centered until the pointer enters the canvas', () => {
    expect(DEFAULT_P5_SKETCH_SOURCE).toContain('const pointerIsInside =');
    expect(DEFAULT_P5_SKETCH_SOURCE).toContain('pointerIsInside ? mouseX : width / 2');
    expect(DEFAULT_P5_SKETCH_SOURCE).toContain('pointerIsInside ? mouseY : height / 2');
  });

  it('resolves the mount after document load and reports ready only after a canvas is attached', () => {
    const sandboxDocument = buildP5SandboxDocument(DEFAULT_P5_SKETCH_SOURCE, 'mount-contract', '/p5.js');

    expect(sandboxDocument).toMatch(/new runnerWindow\.p5\(sketch, ["']sketch["']\)/u);
    expect(sandboxDocument).not.toMatch(
      /new runnerWindow\.p5\(sketch, runnerDocument\.getElementById\(["']sketch["']\)\)/u,
    );
    expect(sandboxDocument).toMatch(/runnerDocument\.querySelector\(["']#sketch canvas["']\)/u);
    expect(sandboxDocument).toContain('#sketch{display:grid;place-items:center}');
    expect(sandboxDocument).toContain('width:auto!important;height:auto!important');
    const drawIndex = sandboxDocument.indexOf('await program.draw?.(...args);');
    const readyIndex = sandboxDocument.indexOf('signalReady();', drawIndex);
    expect(drawIndex).toBeGreaterThan(-1);
    expect(readyIndex).toBeGreaterThan(drawIndex);
  });
});

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
});
