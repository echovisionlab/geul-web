// @vitest-environment jsdom
import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTiptapWireExtensions } from '@/features/editor/tiptap/wire-schema';
import { createEditorMediaRuntimeStore } from '@/features/editor/lib/editor-media-runtime-store';
import { createTiptapEditorMediaCommandPort } from '@/features/editor/lib/media-block-updates';
import { insertLocalPreviewFiles } from './local-media-insert';
afterEach(() => vi.restoreAllMocks());
describe('local file insertion preview', () => {
  it('inserts through the actual production command port and keeps delivery metadata outside the durable document', async () => {
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
    const runtimeStore = createEditorMediaRuntimeStore();
    const file = new File(['%PDF-1.7\n'], 'example.pdf', { type: 'application/pdf' });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:local-preview') });
    const retainUrl = vi.fn();
    const onError = vi.fn();
    await insertLocalPreviewFiles({ editor, runtimeStore, files: [file], retainUrl, onError });
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
    editor.destroy();
    element.remove();
  });
});
