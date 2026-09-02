import type { HocuspocusProvider } from '@hocuspocus/provider';
import { describe, expect, it } from 'vitest';
import { resolveCollaborativeDocumentState } from './document-state';

describe('resolveCollaborativeDocumentState', () => {
  const asProvider = (kind: string) => ({ kind }) as unknown as HocuspocusProvider;
  const base = {
    provider: asProvider('base-provider'),
    doc: { kind: 'base-doc' },
    isConnected: true,
    isSynced: true,
  };

  const scoped = {
    provider: asProvider('scoped-provider'),
    doc: { kind: 'scoped-doc' },
    isConnected: true,
    isSynced: false,
  };

  it('keeps the base document when scoped mode is disabled', () => {
    expect(
      resolveCollaborativeDocumentState({
        base,
        scoped,
        shouldUseScopedDocument: false,
      }),
    ).toEqual(base);
  });

  it('switches to the scoped document and combines connection state', () => {
    expect(
      resolveCollaborativeDocumentState({
        base,
        scoped,
        shouldUseScopedDocument: true,
      }),
    ).toEqual({
      provider: scoped.provider,
      doc: scoped.doc,
      isConnected: true,
      isSynced: false,
    });
  });

  it('can hold the scoped document until sync is ready', () => {
    expect(
      resolveCollaborativeDocumentState({
        base,
        scoped,
        shouldUseScopedDocument: true,
        requireScopedSync: true,
      }),
    ).toEqual({
      provider: null,
      doc: null,
      isConnected: true,
      isSynced: false,
    });
  });
});
