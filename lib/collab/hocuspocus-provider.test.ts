// @vitest-environment jsdom

import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setHocuspocusResumeToken } from './hocuspocus-provider';

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
