// @vitest-environment jsdom

import { randomTestId, randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { Editor } from '@tiptap/core';
import { describe, expect, it, vi } from 'vitest';
import {
  createTiptapEditorMediaCommandPort,
  pickNeutralPropsFromBlock,
  selectDurableEditorFileProps,
} from './media-block-updates';
import { createTiptapWireExtensions } from '../tiptap/wire-schema';

describe('pickNeutralPropsFromBlock', () => {
  it('keeps canonical file identity and layout in neutral prop extraction', () => {
    const fileId = randomTestUuid();

    expect(
      pickNeutralPropsFromBlock({
        id: randomTestId('file'),
        type: 'file',
        props: {
          fileId,
          pendingUploadFileId: randomTestUuid(),
          url: 'https://cdn.example.com/file.pdf',
          name: 'file.pdf',
          mimeType: 'application/pdf',
          size: '2048',
          processingStatus: 'completed',
          processingProgress: '100',
          previewWidth: '54',
          textAlignment: 'right',
        },
      }),
    ).toEqual({
      fileId,
      name: 'file.pdf',
      previewWidth: '54',
      textAlignment: 'right',
    });
  });

  it('keeps only authored shared fields from canonical file blocks', () => {
    expect(
      pickNeutralPropsFromBlock({
        id: randomTestId('file'),
        type: 'file',
        props: {
          name: 'Authored file name',
          url: 'https://cdn.example.com/raw-name.pdf',
          caption: 'Localized caption',
        },
      }),
    ).toEqual({
      name: 'Authored file name',
    });
  });
});

describe('createTiptapEditorMediaCommandPort', () => {
  it('updates content attributes without changing the durable block container id', () => {
    const blockId = randomTestUuid();
    const previousFileId = randomTestUuid();
    const fileId = randomTestUuid();
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
                attrs: { id: blockId },
                content: [{ type: 'file', attrs: { fileId: previousFileId, name: '' } }],
              },
            ],
          },
        ],
      },
    });
    const applyNeutralBlockProps = vi.fn();
    const port = createTiptapEditorMediaCommandPort(editor, { applyNeutralBlockProps });

    expect(port.updateBlockProps(blockId, { fileId, name: 'Field recording' })).toBe(true);
    expect(port.getBlock(blockId)).toMatchObject({
      id: blockId,
      type: 'file',
      props: { fileId, name: 'Field recording' },
    });
    expect(editor.state.doc.firstChild?.firstChild?.attrs.id).toBe(blockId);
    port.applyNeutralBlockProps?.(blockId, { fileId });
    expect(applyNeutralBlockProps).toHaveBeenCalledWith(blockId, { fileId });
    editor.destroy();
    element.remove();
  });

  it('inserts only blocks supported by the active Tiptap profile', () => {
    const anchorBlockId = randomTestUuid();
    const insertedBlockId = randomTestUuid();
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
                attrs: { id: anchorBlockId },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'anchor' }] }],
              },
            ],
          },
        ],
      },
    });
    const port = createTiptapEditorMediaCommandPort(editor);

    expect(
      port.insertBlock(
        { id: insertedBlockId, type: 'file', props: { fileId: randomTestUuid(), name: 'Audio' } },
        { referenceBlockId: anchorBlockId },
      ),
    ).toEqual({ ok: true, blockId: insertedBlockId });
    expect(port.getBlock(insertedBlockId)).toMatchObject({ id: insertedBlockId, type: 'file' });
    editor.destroy();
    element.remove();
  });

  it('captures a durable block anchor without a legacy Y-ProseMirror binding', () => {
    const anchorBlockId = randomTestUuid();
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
                attrs: { id: anchorBlockId },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: '/file' }] }],
              },
            ],
          },
        ],
      },
    });
    const port = createTiptapEditorMediaCommandPort(editor);

    expect(port.captureInsertPosition(anchorBlockId)).toEqual({ referenceBlockId: anchorBlockId });

    editor.destroy();
    element.remove();
  });

  it('fails closed when deferred media work reaches a destroyed editor', () => {
    const blockId = randomTestUuid();
    const fileId = randomTestUuid();
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
                attrs: { id: blockId },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'anchor' }] }],
              },
            ],
          },
        ],
      },
    });
    const applyNeutralBlockProps = vi.fn();
    const deleteNeutralBlock = vi.fn();
    const port = createTiptapEditorMediaCommandPort(editor, { applyNeutralBlockProps, deleteNeutralBlock });
    editor.destroy();

    expect(port.getBlock(blockId)).toBeNull();
    expect(port.updateBlockProps(blockId, { name: 'late update' })).toBe(false);
    expect(port.deleteBlock(blockId)).toBe(false);
    expect(port.captureInsertPosition(blockId)).toBeNull();
    expect(port.insertBlock({ id: randomTestUuid(), type: 'file', props: { fileId } }, null)).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    port.applyNeutralBlockProps?.(blockId, { fileId });
    port.deleteNeutralBlock?.(blockId);
    expect(applyNeutralBlockProps).not.toHaveBeenCalled();
    expect(deleteNeutralBlock).not.toHaveBeenCalled();
    element.remove();
  });

  it('rejects a File block whose active File identity is not a UUID', () => {
    expect(() => selectDurableEditorFileProps({ fileId: 'legacy-file-id' })).toThrow(/must be a UUID/u);
  });
});
