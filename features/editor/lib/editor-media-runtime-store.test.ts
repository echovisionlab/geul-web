import { describe, expect, it, vi } from 'vitest';
import { createEditorMediaRuntimeStore } from './editor-media-runtime-store';

const blockA = '01b3db42-75f1-4bf1-8cb9-9b3baf57e795';
const blockB = 'b67328c4-668c-5bf2-8f1e-41465149ded6';
const fileA = '8929fbc6-0a08-46f0-8fec-3dc7dbfaf784';
const fileB = 'dc0be55b-926a-4fbb-8910-b59a7412d3ce';

describe('createEditorMediaRuntimeStore', () => {
  it('shares verified File runtime metadata across every referencing Block', () => {
    const store = createEditorMediaRuntimeStore();
    store.bindFile(blockA, fileA);
    store.bindFile(blockB, fileA);
    store.patchFile(fileA, { mimeType: 'image/webp', fileName: 'cover.webp', url: `/asset/${fileA}.webp` });

    expect(store.getSnapshot(blockA)).toEqual({
      file: { mimeType: 'image/webp', fileName: 'cover.webp', url: `/asset/${fileA}.webp` },
    });
    expect(store.getSnapshot(blockB)).toEqual({
      file: { mimeType: 'image/webp', fileName: 'cover.webp', url: `/asset/${fileA}.webp` },
    });
  });

  it('notifies every Block bound to changed File state', () => {
    const store = createEditorMediaRuntimeStore();
    const first = vi.fn();
    const second = vi.fn();
    store.bindFile(blockA, fileA);
    store.bindFile(blockB, fileA);
    store.subscribe(blockA, first);
    store.subscribe(blockB, second);

    store.patchFile(fileA, { processingStatus: 'ready' });

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it('clears File runtime fields without retaining empty-string sentinels', () => {
    const store = createEditorMediaRuntimeStore();
    store.bindFile(blockA, fileA);
    store.patchFile(fileA, { mimeType: 'image/webp' });
    store.patchFile(fileA, { mimeType: '' });

    expect(store.getSnapshot(blockA)).toEqual({});
  });

  it('treats an empty optional File identity as unbound runtime state', () => {
    const store = createEditorMediaRuntimeStore();

    expect(store.getSnapshot(blockA, '')).toEqual({});
  });

  it('lets only the current NodeView generation release a Block binding', () => {
    const store = createEditorMediaRuntimeStore();
    const releasePrevious = store.acquireFileBinding(blockA, fileA);
    const releaseCurrent = store.acquireFileBinding(blockA, fileA);
    store.patchFile(fileA, { mimeType: 'audio/wav' });

    releasePrevious();
    expect(store.getSnapshot(blockA)).toEqual({ file: { mimeType: 'audio/wav' } });

    releaseCurrent();
    expect(store.getSnapshot(blockA)).toEqual({});
    expect(store.getSnapshot(blockA, fileA)).toEqual({ file: { mimeType: 'audio/wav' } });

    const releaseRemounted = store.acquireFileBinding(blockA, fileA);
    expect(store.getSnapshot(blockA)).toEqual({ file: { mimeType: 'audio/wav' } });
    releaseRemounted();
  });

  it('does not let an old File generation clear its replacement binding', () => {
    const store = createEditorMediaRuntimeStore();
    const releasePrevious = store.acquireFileBinding(blockA, fileA);
    const releaseCurrent = store.acquireFileBinding(blockA, fileB);
    store.patchFile(fileB, { mimeType: 'image/webp' });

    releasePrevious();
    expect(store.getSnapshot(blockA)).toEqual({ file: { mimeType: 'image/webp' } });

    releaseCurrent();
    expect(store.getSnapshot(blockA)).toEqual({});
    expect(store.getSnapshot(blockA, fileB)).toEqual({ file: { mimeType: 'image/webp' } });
  });

  it('keeps resident File metadata across a transient NodeView unmount and reacquire', () => {
    const store = createEditorMediaRuntimeStore();
    const release = store.acquireFileBinding(blockA, fileA);
    store.patchFile(fileA, {
      mimeType: 'audio/wav',
      originalUrl: `/asset/${fileA}.wav`,
      processingStatus: 'ready',
    });

    release();
    const releaseRemounted = store.acquireFileBinding(blockA, fileA);

    expect(store.getSnapshot(blockA)).toEqual({
      file: {
        mimeType: 'audio/wav',
        originalUrl: `/asset/${fileA}.wav`,
        processingStatus: 'ready',
      },
    });
    releaseRemounted();
  });

  it('fails closed on legacy Block and File identities', () => {
    const store = createEditorMediaRuntimeStore();

    expect(() => store.bindFile('legacy-block', fileA)).toThrow(/Block identity must be a UUID/u);
    expect(() => store.bindFile(blockA, 'legacy-file')).toThrow(/File identity must be a UUID/u);
  });
});
