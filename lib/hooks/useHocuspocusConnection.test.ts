import { describe, expect, it } from 'vitest';
import { buildCollaborationWebsocketUrl } from './useHocuspocusConnection';

describe('buildCollaborationWebsocketUrl', () => {
  it('routes a canonical locale document through the locale-scoped gateway path', () => {
    expect(
      buildCollaborationWebsocketUrl(
        'email-layout:11111111-1111-4111-8111-111111111111:zh-Hant',
        'https://www.example.invalid',
        '/collab',
      ),
    ).toBe('wss://www.example.invalid/collab/email-layout/11111111-1111-4111-8111-111111111111/zh-Hant');
  });

  it('rejects legacy and role-bearing document names', () => {
    expect(() =>
      buildCollaborationWebsocketUrl(
        'email-layout:11111111-1111-4111-8111-111111111111',
        'https://www.example.invalid',
        '/collab',
      ),
    ).toThrow(/Invalid document name format/u);
    expect(() =>
      buildCollaborationWebsocketUrl(
        'email-layout:11111111-1111-4111-8111-111111111111:source',
        'https://www.example.invalid',
        '/collab',
      ),
    ).toThrow(/Invalid collaboration locale/u);
  });
});
