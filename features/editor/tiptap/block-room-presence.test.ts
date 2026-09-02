// @vitest-environment jsdom

import { Editor } from '@tiptap/core';
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createBlockRoomPresenceExtension } from './block-room-presence';
import { BlockMixedSelection } from './integration/block-mixed-selection';
import { createTiptapWireExtensions } from './wire-schema';

const BLOCK_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b13';
const VIDEO_BLOCK_ID = '019cce25-dbc0-7d12-9f1f-735b1a6c6b14';

function createEditor(awareness: Awareness, name: string, color: string): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  return new Editor({
    element,
    extensions: [...createTiptapWireExtensions(), createBlockRoomPresenceExtension(awareness, { name, color })],
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: BLOCK_ID },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }],
            },
          ],
        },
      ],
    },
  });
}

describe('typed Block-room presence', () => {
  it('publishes Block-local selections and renders remote awareness without ySync mapping', () => {
    vi.useFakeTimers();
    const first = new Awareness(new Y.Doc());
    const second = new Awareness(new Y.Doc());
    const firstEditor = createEditor(first, 'Alice', '#112233');
    const secondEditor = createEditor(second, 'Bob', '#445566');

    firstEditor.commands.setTextSelection(5);
    vi.advanceTimersByTime(16);
    applyAwarenessUpdate(second, encodeAwarenessUpdate(first, [first.clientID]), 'presence-test');
    vi.advanceTimersByTime(16);

    expect(first.getLocalState()).toMatchObject({
      user: { name: 'Alice', color: '#112233' },
      geulBlockCursor: {
        anchor: { blockId: BLOCK_ID, offset: expect.any(Number) },
        head: { blockId: BLOCK_ID, offset: expect.any(Number) },
      },
    });
    const cursor = secondEditor.view.dom.querySelector('.block-room-cursor');
    expect(cursor?.querySelector('.block-room-cursor-label')?.textContent).toBe('Alice');

    firstEditor.destroy();
    secondEditor.destroy();
    first.destroy();
    second.destroy();
  });

  it('coalesces selection transaction bursts and still publishes the final cursor', () => {
    vi.useFakeTimers();
    const awareness = new Awareness(new Y.Doc());
    const setLocalState = vi.spyOn(awareness, 'setLocalState');
    const editor = createEditor(awareness, 'Alice', '#112233');
    setLocalState.mockClear();

    for (let index = 0; index < 100; index += 1) {
      editor.commands.setTextSelection(index % 2 === 0 ? 4 : 5);
    }

    expect(setLocalState).not.toHaveBeenCalled();
    vi.advanceTimersByTime(16);
    expect(setLocalState).toHaveBeenCalledTimes(1);
    expect(awareness.getLocalState()?.geulBlockCursor).toMatchObject({
      anchor: { blockId: BLOCK_ID },
      head: { blockId: BLOCK_ID },
    });

    editor.destroy();
    awareness.destroy();
  });

  it('publishes a structural mixed-selection edge at the complete standalone Block boundary', () => {
    vi.useFakeTimers();
    const awareness = new Awareness(new Y.Doc());
    const editor = createEditor(awareness, 'Alice', '#112233');
    const blockGroup = editor.state.doc.firstChild!;
    const video = editor.schema.nodes.blockContainer.create(
      { id: VIDEO_BLOCK_ID },
      editor.schema.nodes.externalVideo.create({ url: 'https://youtu.be/dQw4w9WgXcQ' }),
    );
    const videoPosition = blockGroup.content.size + 1;
    editor.view.dispatch(editor.state.tr.insert(videoPosition, video));
    const selection = BlockMixedSelection.create(editor.state.doc, 4, videoPosition + video.nodeSize);

    editor.view.dispatch(editor.state.tr.setSelection(selection));
    vi.advanceTimersByTime(16);

    expect(awareness.getLocalState()?.geulBlockCursor).toEqual({
      anchor: { blockId: BLOCK_ID, offset: 2 },
      head: { blockId: VIDEO_BLOCK_ID, offset: video.content.size + 1 },
    });

    editor.destroy();
    awareness.destroy();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
