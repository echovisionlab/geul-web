import type { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { persistCollaborativeDocumentNow } from '@/lib/collab/persist-now';
import { flushEditorSaves, hasPendingEditorSaves } from './editor-save-registry';
import {
  createCollaborativeDocumentReplayOrigin,
  registerCollaborativeDocumentSave,
} from './collaborative-document-save';

vi.mock('@/lib/collab/persist-now', () => ({
  persistCollaborativeDocumentNow: vi.fn(),
}));

const persistNow = vi.mocked(persistCollaborativeDocumentNow);
const unregisterCallbacks: Array<() => void> = [];
const documents: Y.Doc[] = [];

function attachDocumentSave(documentKey = 'post:post-1') {
  const document = new Y.Doc();
  documents.push(document);
  const provider = { document } as unknown as HocuspocusProvider;
  unregisterCallbacks.push(registerCollaborativeDocumentSave(provider, documentKey));
  return { document, provider };
}

afterEach(() => {
  unregisterCallbacks.splice(0).forEach((unregister) => unregister());
  documents.splice(0).forEach((document) => document.destroy());
  persistNow.mockReset();
});

describe('registerCollaborativeDocumentSave', () => {
  it('keeps semantic replay pending despite the remote flag on Y.applyUpdate', async () => {
    const { document } = attachDocumentSave();
    const staged = new Y.Doc();
    staged.getMap('content').set('title', 'Recovered author intent');
    Y.applyUpdate(document, Y.encodeStateAsUpdate(staged), createCollaborativeDocumentReplayOrigin());
    staged.destroy();
    expect(hasPendingEditorSaves('post:post-1')).toBe(true);
    persistNow.mockRejectedValueOnce(new Error('not durable')).mockResolvedValueOnce();
    await expect(flushEditorSaves('post:post-1')).resolves.toBe(false);
    await expect(flushEditorSaves('post:post-1')).resolves.toBe(true);
  });
  it('ignores remote document changes and remains clean until a local edit', async () => {
    const { document, provider } = attachDocumentSave();
    persistNow.mockResolvedValue();

    const remoteDocument = new Y.Doc();
    remoteDocument.getMap('content').set('title', 'Remote title');
    Y.applyUpdate(document, Y.encodeStateAsUpdate(remoteDocument), 'remote');
    remoteDocument.destroy();

    // Some provider-side metadata projections use a local Y transaction with
    // the provider as origin; these are still not authored document edits.
    document.transact(() => {
      document.getMap('collaboration-revision').set('documentRevision', 'server-projected-revision');
    }, provider);

    expect(hasPendingEditorSaves('post:post-1')).toBe(false);
    expect(await flushEditorSaves('post:post-1')).toBe(true);
    expect(persistNow).not.toHaveBeenCalled();

    document.getMap('content').set('title', 'Local title');
    expect(hasPendingEditorSaves('post:post-1')).toBe(true);
    expect(await flushEditorSaves('post:post-1')).toBe(true);
    expect(persistNow).toHaveBeenCalledTimes(1);
    expect(persistNow).toHaveBeenCalledWith(expect.objectContaining({ document }));
    expect(hasPendingEditorSaves('post:post-1')).toBe(false);
  });

  it('drains local edits made while an earlier persistence request is in flight', async () => {
    const { document } = attachDocumentSave();
    let completeFirst = () => {};
    persistNow
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            completeFirst = resolve;
          }),
      )
      .mockResolvedValueOnce();

    document.getMap('content').set('title', 'First edit');
    const flush = flushEditorSaves('post:post-1');
    expect(persistNow).toHaveBeenCalledTimes(1);

    document.getMap('content').set('summary', 'Edit while saving');
    expect(hasPendingEditorSaves('post:post-1')).toBe(true);

    completeFirst();
    await expect(flush).resolves.toBe(true);
    expect(persistNow).toHaveBeenCalledTimes(2);
    expect(hasPendingEditorSaves('post:post-1')).toBe(false);
  });

  it('keeps a failed local revision pending and retries it on a later flush', async () => {
    const { document } = attachDocumentSave();
    persistNow.mockRejectedValueOnce(new Error('write failed')).mockResolvedValueOnce();
    document.getMap('content').set('title', 'Retry me');

    await expect(flushEditorSaves('post:post-1')).resolves.toBe(false);
    expect(hasPendingEditorSaves('post:post-1')).toBe(true);
    await expect(flushEditorSaves('post:post-1')).resolves.toBe(true);
    expect(persistNow).toHaveBeenCalledTimes(2);
    expect(hasPendingEditorSaves('post:post-1')).toBe(false);
  });
});
