// @vitest-environment jsdom

import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAdmissionRetry,
  flushHocuspocusUpdatesOnPageHide,
  reconnectHocuspocusProvider,
  setHocuspocusResumeToken,
} from './hocuspocus-provider';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  binaryType = '';

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(): void {}

  removeEventListener(): void {}

  send(): void {}

  close(): void {}
}

let provider: HocuspocusProvider | undefined;
let document: Y.Doc | undefined;

afterEach(() => {
  provider?.destroy();
  document?.destroy();
  provider = undefined;
  document = undefined;
  FakeWebSocket.instances = [];
  vi.unstubAllGlobals();
});

describe('setHocuspocusResumeToken', () => {
  it('updates the token without creating a second browser socket', async () => {
    const websocketUrl = 'wss://www.example.invalid/collab/post/11111111-1111-4111-8111-111111111111/ko';
    vi.stubGlobal('WebSocket', FakeWebSocket);
    document = new Y.Doc();
    const websocketProvider = new HocuspocusProviderWebsocket({
      url: websocketUrl,
      WebSocketPolyfill: FakeWebSocket,
    });
    provider = new HocuspocusProvider({
      name: 'post:11111111-1111-4111-8111-111111111111:ko',
      document,
      websocketProvider,
    });

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0]?.url).toBe(websocketUrl);

    const residentWebsocketProvider = provider.configuration.websocketProvider;
    setHocuspocusResumeToken(provider, 'challenge-1');

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(provider.configuration.websocketProvider).toBe(residentWebsocketProvider);
    expect(await provider.getToken()).toBe('challenge-1');
  });
});
it('sends buffered updates when the page is hidden or unloaded, until released', () => {
  const provider = { flushPendingUpdates: vi.fn() };
  const visibility = vi.spyOn(globalThis.document, 'visibilityState', 'get').mockReturnValue('visible');
  const release = flushHocuspocusUpdatesOnPageHide(provider);

  globalThis.document.dispatchEvent(new Event('visibilitychange'));
  expect(provider.flushPendingUpdates).not.toHaveBeenCalled();
  visibility.mockReturnValue('hidden');
  globalThis.document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('pagehide'));
  expect(provider.flushPendingUpdates).toHaveBeenCalledTimes(2);

  release();
  window.dispatchEvent(new Event('pagehide'));
  globalThis.document.dispatchEvent(new Event('visibilitychange'));
  expect(provider.flushPendingUpdates).toHaveBeenCalledTimes(2);
  visibility.mockRestore();
});

/** A socket that closes asynchronously, like a browser WebSocket. */
class ClosingWebSocket {
  static instances: ClosingWebSocket[] = [];

  readonly url: string;
  binaryType = '';
  readyState = 0;
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(url: string) {
    this.url = url;
    ClosingWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  open(): void {
    this.readyState = 1;
    this.dispatch('open', {});
  }

  send(): void {}

  close(): void {
    if (this.readyState >= 2) {
      return;
    }
    this.readyState = 2;
    setTimeout(() => {
      this.readyState = 3;
      this.dispatch('close', { code: 1000, reason: '' });
    }, 0);
  }

  private dispatch(type: string, event: unknown): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener(event);
    }
  }
}

describe('reconnectHocuspocusProvider', () => {
  afterEach(() => {
    ClosingWebSocket.instances = [];
    vi.useRealTimers();
  });

  function openProvider() {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', ClosingWebSocket);
    document = new Y.Doc();
    provider = new HocuspocusProvider({
      url: 'wss://www.example.invalid/collab/post/11111111-1111-4111-8111-111111111111/ko',
      name: 'post:11111111-1111-4111-8111-111111111111:ko',
      document,
    });
    ClosingWebSocket.instances[0]!.open();
    return provider;
  }

  it('opens a new socket once the old one has closed', async () => {
    const opened = openProvider();
    // The bug: connect() right after disconnect() returns early while the socket is still open.
    opened.disconnect();
    void opened.connect();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(ClosingWebSocket.instances).toHaveLength(1);

    provider?.destroy();
    ClosingWebSocket.instances.length = 0;
    const reopened = openProvider();
    reconnectHocuspocusProvider(reopened, () => true);
    await vi.advanceTimersByTimeAsync(100);
    expect(ClosingWebSocket.instances).toHaveLength(2);
    expect(ClosingWebSocket.instances[1]!.readyState).toBe(0);
  });

  it('stays closed when cancelled or no longer wanted at close time', async () => {
    const opened = openProvider();
    const cancel = reconnectHocuspocusProvider(opened, () => true);
    cancel();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(ClosingWebSocket.instances).toHaveLength(1);

    provider?.destroy();
    ClosingWebSocket.instances.length = 0;
    const terminal = openProvider();
    let wanted = true;
    reconnectHocuspocusProvider(terminal, () => wanted);
    wanted = false;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(ClosingWebSocket.instances).toHaveLength(1);
  });

  it('connects at once when the socket is already closed', () => {
    const provider = {
      on: vi.fn(),
      off: vi.fn(),
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
      configuration: { websocketProvider: { status: 'disconnected' } },
    };
    reconnectHocuspocusProvider(provider, () => true);
    expect(provider.connect).toHaveBeenCalledOnce();
    expect(provider.disconnect).not.toHaveBeenCalled();
  });
});

describe('createAdmissionRetry', () => {
  function fakeProvider() {
    return {
      on: vi.fn(),
      off: vi.fn(),
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
      configuration: { websocketProvider: { status: 'disconnected' } },
    };
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('readmits after a doubling, capped delay and starts over once admitted', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const provider = fakeProvider();
    const retry = createAdmissionRetry(provider, () => true);
    const delays: number[] = [];
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const before = provider.connect.mock.calls.length;
      retry.schedule();
      retry.schedule();
      let waited = 0;
      while (provider.connect.mock.calls.length === before) {
        await vi.advanceTimersByTimeAsync(250);
        waited += 250;
      }
      delays.push(waited);
    }
    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);
    retry.reset();
    retry.schedule();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(provider.connect).toHaveBeenCalledTimes(8);
  });

  it('drops a pending retry once the provider was admitted by its own reconnect', async () => {
    vi.useFakeTimers();
    const provider = fakeProvider();
    const retry = createAdmissionRetry(provider, () => true);
    retry.schedule();
    retry.reset();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(provider.connect).not.toHaveBeenCalled();
    expect(provider.disconnect).not.toHaveBeenCalled();
  });

  it('does not readmit when cancelled or no longer wanted', async () => {
    vi.useFakeTimers();
    const provider = fakeProvider();
    let wanted = true;
    const retry = createAdmissionRetry(provider, () => wanted);
    retry.schedule();
    retry.cancel();
    await vi.advanceTimersByTimeAsync(60_000);
    retry.schedule();
    wanted = false;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(provider.connect).not.toHaveBeenCalled();
  });
});
