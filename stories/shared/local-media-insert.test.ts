// @vitest-environment jsdom
import { Editor } from '@tiptap/core';
import { describe, expect, it, vi, type TestContext } from 'vitest';
import { createTiptapWireExtensions } from '@/features/editor/tiptap/wire-schema';
import { createEditorMediaRuntimeStore } from '@/features/editor/lib/editor-media-runtime-store';
import { createTiptapEditorMediaCommandPort } from '@/features/editor/lib/media-block-updates';
import { insertLocalPreviewFiles } from './local-media-insert';
function previewEditor(context: TestContext) {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: createTiptapWireExtensions(),
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: '10000000-0000-4000-8000-000000000402' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Anchor' }] }],
            },
          ],
        },
      ],
    },
  });
  context.onTestFinished(() => {
    if (!editor.isDestroyed) editor.destroy();
    element.remove();
  });
  return editor;
}

function previewObjectUrls(context: TestContext) {
  const create = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const revoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  const createObjectURL = vi.fn(() => 'blob:local-preview');
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
  context.onTestFinished(() => {
    if (create) Object.defineProperty(URL, 'createObjectURL', create);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (revoke) Object.defineProperty(URL, 'revokeObjectURL', revoke);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  });
  return { createObjectURL, revokeObjectURL };
}

describe('local file insertion preview', () => {
  it('inserts through the production command port and keeps delivery metadata outside the durable document', async (context) => {
    const editor = previewEditor(context);
    const { revokeObjectURL } = previewObjectUrls(context);
    const lifetime = new AbortController();
    const retained: string[] = [];
    const release = () => {
      lifetime.abort();
      for (const url of retained.splice(0)) URL.revokeObjectURL(url);
    };
    context.onTestFinished(release);
    const runtimeStore = createEditorMediaRuntimeStore();
    const file = new File(['%PDF-1.7\n'], 'example.pdf', { type: 'application/pdf' });
    const retainUrl = vi.fn((url: string) => retained.push(url));
    const onError = vi.fn();
    await insertLocalPreviewFiles({ editor, runtimeStore, signal: lifetime.signal, files: [file], retainUrl, onError });
    expect(onError).not.toHaveBeenCalled();
    let blockId = '';
    let fileId = '';
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'file') {
        fileId = node.attrs.fileId;
        blockId = editor.state.doc.resolve(pos).parent.attrs.id;
      }
    });
    expect(fileId).toMatch(/^[a-f0-9-]{36}$/);
    expect(runtimeStore.getSnapshot(blockId, fileId).file).toMatchObject({
      fileName: 'example.pdf',
      url: 'blob:local-preview',
      processingStatus: 'ready',
    });
    expect(JSON.stringify(editor.getJSON())).not.toContain('blob:local-preview');
    expect(createTiptapEditorMediaCommandPort(editor, { runtimeStore }).getBlock(blockId)?.type).toBe('file');
    expect(retainUrl).toHaveBeenCalledWith('blob:local-preview');
    release();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:local-preview');
  });

  it.for(['abort', 'destroy-editor'] as const)(
    'drops a pending file read after its owner ends: %s',
    async (endOwner, context) => {
      const editor = previewEditor(context);
      const { createObjectURL, revokeObjectURL } = previewObjectUrls(context);
      const runtimeStore = createEditorMediaRuntimeStore();
      const patchFile = vi.spyOn(runtimeStore, 'patchFile');
      const lifetime = new AbortController();
      let finishRead!: (value: ArrayBuffer) => void;
      let notifyReadStarted!: () => void;
      const readStarted = new Promise<void>((resolve) => {
        notifyReadStarted = resolve;
      });
      const bytes = new Promise<ArrayBuffer>((resolve) => {
        finishRead = resolve;
      });
      const file = new File(['%PDF-1.7\n'], 'pending.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'arrayBuffer', {
        value: () => {
          notifyReadStarted();
          return bytes;
        },
      });
      const retainUrl = vi.fn();
      const onError = vi.fn();
      const onDelivered = vi.fn();
      const insertion = insertLocalPreviewFiles({
        editor,
        runtimeStore,
        signal: lifetime.signal,
        files: [file],
        retainUrl,
        onError,
        onDelivered,
      });
      await readStarted;
      if (endOwner === 'abort') lifetime.abort();
      else editor.destroy();
      finishRead(new ArrayBuffer(0));
      await insertion;
      expect(createObjectURL).not.toHaveBeenCalled();
      expect(revokeObjectURL).not.toHaveBeenCalled();
      expect(retainUrl).not.toHaveBeenCalled();
      expect(patchFile).not.toHaveBeenCalled();
      expect(onDelivered).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    },
  );

  it('revokes a newly created URL immediately if its owner ends before the URL can be retained', async (context) => {
    const editor = previewEditor(context);
    const initialDocument = editor.getJSON();
    const runtimeStore = createEditorMediaRuntimeStore();
    const patchFile = vi.spyOn(runtimeStore, 'patchFile');
    const lifetime = new AbortController();
    const { createObjectURL, revokeObjectURL } = previewObjectUrls(context);
    createObjectURL.mockImplementation(() => {
      lifetime.abort();
      return 'blob:local-preview';
    });
    const retainUrl = vi.fn();
    const onDelivered = vi.fn();
    const onError = vi.fn();
    await insertLocalPreviewFiles({
      editor,
      runtimeStore,
      signal: lifetime.signal,
      files: [new File(['%PDF-1.7\n'], 'racing.pdf', { type: 'application/pdf' })],
      retainUrl,
      onDelivered,
      onError,
    });
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:local-preview');
    expect(retainUrl).not.toHaveBeenCalled();
    expect(patchFile).not.toHaveBeenCalled();
    expect(onDelivered).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(editor.getJSON()).toEqual(initialDocument);
  });

  it('does not insert into the editor if the owner ends between delivery and insertion', async (context) => {
    const editor = previewEditor(context);
    const initialDocument = editor.getJSON();
    const runtimeStore = createEditorMediaRuntimeStore();
    const lifetime = new AbortController();
    const { revokeObjectURL } = previewObjectUrls(context);
    const retained: string[] = [];
    lifetime.signal.addEventListener(
      'abort',
      () => {
        for (const url of retained.splice(0)) URL.revokeObjectURL(url);
      },
      { once: true },
    );
    const onDelivered = vi.fn(() => lifetime.abort());
    const onError = vi.fn();
    await insertLocalPreviewFiles({
      editor,
      runtimeStore,
      signal: lifetime.signal,
      files: [new File(['%PDF-1.7\n'], 'delivered.pdf', { type: 'application/pdf' })],
      retainUrl: (url) => {
        retained.push(url);
      },
      onDelivered,
      onError,
    });
    expect(onDelivered).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:local-preview');
    expect(onError).not.toHaveBeenCalled();
    expect(editor.getJSON()).toEqual(initialDocument);
  });
});
