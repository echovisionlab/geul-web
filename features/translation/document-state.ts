'use client';

import type { HocuspocusProvider } from '@hocuspocus/provider';

export interface CollaborativeDocumentState<TDoc> {
  provider: HocuspocusProvider | null;
  doc: TDoc | null;
  isConnected: boolean;
  isSynced: boolean;
}

interface ResolveCollaborativeDocumentStateInput<TDoc> {
  base: CollaborativeDocumentState<TDoc>;
  scoped: CollaborativeDocumentState<TDoc>;
  shouldUseScopedDocument: boolean;
  requireScopedSync?: boolean;
}

export function resolveCollaborativeDocumentState<TDoc>({
  base,
  scoped,
  shouldUseScopedDocument,
  requireScopedSync = false,
}: ResolveCollaborativeDocumentStateInput<TDoc>): CollaborativeDocumentState<TDoc> {
  if (!shouldUseScopedDocument) {
    return base;
  }

  const combinedConnectionState = {
    isConnected: base.isConnected && scoped.isConnected,
    isSynced: base.isSynced && scoped.isSynced,
  };

  if (requireScopedSync && !scoped.isSynced) {
    return {
      provider: null,
      doc: null,
      ...combinedConnectionState,
    };
  }

  return {
    provider: scoped.provider,
    doc: scoped.doc,
    ...combinedConnectionState,
  };
}
