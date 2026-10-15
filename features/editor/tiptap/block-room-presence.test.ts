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

function createEditor(awareness: Awareness, name: string, color: string, readUser = () => ({ name, color })): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  return new Editor({
    element,
    extensions: [
      ...createTiptapWireExtensions(),
      createBlockRoomPresenceExtension(awareness, { name, color }, readUser),
    ],
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
    vi.advanceTimersByTime(100);
    applyAwarenessUpdate(second, encodeAwarenessUpdate(first, [first.clientID]), 'presence-test');
    vi.advanceTimersByTime(100);

    expect(first.getLocalState()).toMatchObject({
      user: { name: 'Alice', color: '#112233' },
      geulBlockCursor: {
        anchor: { blockId: BLOCK_ID, offset: expect.any(Number) },
        head: { blockId: BLOCK_ID, offset: expect.any(Number) },
      },
    });
    const cursor = secondEditor.view.dom.querySelector('.block-room-cursor');
    expect(cursor?.querySelector('.block-room-cursor-label')?.textContent).toBe('Alice');
    expect((cursor as HTMLElement)?.style.borderLeftColor).toBe('rgb(17, 34, 51)');
    expect((cursor?.querySelector('.block-room-cursor-label') as HTMLElement)?.style.backgroundColor).toBe(
      'rgb(17, 34, 51)',
    );
    expect((cursor?.querySelector('.block-room-cursor-label') as HTMLElement)?.style.color).toBe('rgb(255, 255, 255)');

    first.setLocalStateField('user', { name: 'Renamed Alice', color: '#aabbcc' });
    applyAwarenessUpdate(second, encodeAwarenessUpdate(first, [first.clientID]), 'presence-test');
    vi.advanceTimersByTime(100);
    const updated = secondEditor.view.dom.querySelector<HTMLElement>('.block-room-cursor');
    expect(updated?.querySelector('.block-room-cursor-label')?.textContent).toBe('Renamed Alice');
    expect(updated?.style.borderLeftColor).toBe('rgb(170, 187, 204)');
    expect((updated?.querySelector('.block-room-cursor-label') as HTMLElement)?.style.backgroundColor).toBe(
      'rgb(170, 187, 204)',
    );

    first.setLocalStateField('user', { name: 'Renamed Alice', color: 'invalid-peer-color' });
    applyAwarenessUpdate(second, encodeAwarenessUpdate(first, [first.clientID]), 'presence-test');
    vi.advanceTimersByTime(100);
    expect(secondEditor.view.dom.querySelector<HTMLElement>('.block-room-cursor')?.style.borderLeftColor).toBe(
      'rgb(92, 89, 79)',
    );

    firstEditor.destroy();
    secondEditor.destroy();
    first.destroy();
    second.destroy();
  });

  it('uses the shared neutral fallback for an invalid initial remote identity', () => {
    const remote = new Awareness(new Y.Doc());
    const local = new Awareness(new Y.Doc());
    remote.setLocalState({
      user: { name: 'Unknown', color: 'invalid-peer-color' },
      geulBlockCursor: {
        anchor: { blockId: BLOCK_ID, offset: 2 },
        head: { blockId: BLOCK_ID, offset: 2 },
      },
    });
    applyAwarenessUpdate(local, encodeAwarenessUpdate(remote, [remote.clientID]), 'presence-test');
    const editor = createEditor(local, 'Alice', '#112233');
    const cursor = editor.view.dom.querySelector<HTMLElement>('.block-room-cursor');
    expect(cursor?.style.borderLeftColor).toBe('rgb(92, 89, 79)');
    editor.destroy();
    remote.destroy();
    local.destroy();
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
    vi.advanceTimersByTime(100);
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
    vi.advanceTimersByTime(100);

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

it('resolves a version-1 compatible relative cursor after concurrent insertion without a new awareness message', () => {
  vi.useFakeTimers();
  const room = new Y.Doc();
  const text = new Y.Text('hello');
  const payload = new Y.Map();
  const content = new Y.Array();
  payload.set('content', content);
  const item = new Y.Map();
  const styled = new Y.Map();
  styled.set('text', text);
  item.set('text', styled);
  content.push([item]);
  const node = new Y.Map();
  node.set('payload', payload);
  const nodes = new Y.Map();
  nodes.set(BLOCK_ID, node);
  room.getMap('block-document').set('localeOverlay', nodes);
  const peer = new Y.Doc();
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(room));
  const first = new Awareness(room);
  const second = new Awareness(peer);
  const a = createEditor(first, 'Alice', '#112233');
  const b = createEditor(second, 'Bob', '#445566');
  try {
    a.commands.setTextSelection(5);
    vi.advanceTimersByTime(100);
    expect(first.getLocalState()?.geulBlockCursor.anchor).toMatchObject({
      blockId: BLOCK_ID,
      offset: 3,
      relative: expect.any(Array),
    });
    applyAwarenessUpdate(second, encodeAwarenessUpdate(first, [first.clientID]), 'test');
    vi.advanceTimersByTime(100);
    text.insert(0, 'X');
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(room));
    b.view.dispatch(
      b.state.tr
        .insertText('X', 3)
        .setMeta('blockRoomProjection', true)
        .setMeta('blockRoomChangedIds', new Set([BLOCK_ID])),
    );
    const cursor = b.view.dom.querySelector('.block-room-cursor')!;
    const range = document.createRange();
    range.selectNodeContents(b.view.dom);
    range.setEndBefore(cursor);
    expect(range.toString()).toBe('Xhe');
    first.setLocalStateField('geulBlockCursor', {
      anchor: { blockId: BLOCK_ID, offset: 1, relative: ['bad'] },
      head: null,
    });
    expect(() => {
      applyAwarenessUpdate(second, encodeAwarenessUpdate(first, [first.clientID]), 'test');
      vi.advanceTimersByTime(100);
    }).not.toThrow();
  } finally {
    a.destroy();
    b.destroy();
    first.destroy();
    second.destroy();
    room.destroy();
    peer.destroy();
    vi.useRealTimers();
  }
});

it('limits continuous caret publishing to 100 ms and passive identity to 1 s', () => {
  vi.useFakeTimers();
  const awareness = new Awareness(new Y.Doc());
  let user = { name: 'Alice', color: '#112233' };
  const editor = createEditor(awareness, user.name, user.color, () => user);
  const publish = vi.spyOn(awareness, 'setLocalState');
  user = { name: 'Renamed Alice', color: '#445566' };
  for (let i = 0; i < 10; i += 1) {
    editor.commands.setTextSelection(i % 2 ? 4 : 5);
    vi.advanceTimersByTime(10);
  }
  expect(publish).toHaveBeenCalledOnce();
  expect(awareness.getLocalState()?.user.name).toBe('Alice');
  editor.commands.setTextSelection(6);
  vi.advanceTimersByTime(99);
  expect(publish).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(1);
  expect(publish).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(799);
  expect(awareness.getLocalState()?.user.name).toBe('Alice');
  vi.advanceTimersByTime(1);
  expect(awareness.getLocalState()?.user).toEqual(user);
  expect(publish).toHaveBeenCalledTimes(3);
  editor.destroy();
  expect(awareness.getLocalState()).toMatchObject({ user: null, geulBlockCursor: null });
  awareness.destroy();
  vi.useRealTimers();
});

it('publishes a typed caret anchored to the Yjs text the edit just wrote', async () => {
  vi.useFakeTimers();
  const room = new Y.Doc();
  const text = new Y.Text('hello');
  const payload = new Y.Map();
  const content = new Y.Array();
  payload.set('content', content);
  const item = new Y.Map();
  const styled = new Y.Map();
  styled.set('text', text);
  item.set('text', styled);
  content.push([item]);
  const node = new Y.Map();
  node.set('payload', payload);
  const nodes = new Y.Map();
  nodes.set(BLOCK_ID, node);
  room.getMap('block-document').set('localeOverlay', nodes);
  const awareness = new Awareness(room);
  const editor = createEditor(awareness, 'Alice', '#112233');
  // Stand-in for the Block-room controller: it writes local PM edits to Yjs during dispatch,
  // after plugin views have updated.
  editor.on('transaction', ({ transaction }) => {
    if (transaction.docChanged && !transaction.getMeta('blockRoomProjection')) {
      text.insert(0, 'X');
    }
  });
  try {
    editor.commands.setTextSelection(3);
    // Past the caret window, so the edit publishes without waiting for a timer.
    vi.advanceTimersByTime(200);
    editor.commands.insertContentAt(3, 'X');
    await Promise.resolve();
    expect(awareness.getLocalState()?.geulBlockCursor.head).toMatchObject({
      blockId: BLOCK_ID,
      offset: 2,
      relative: expect.any(Array),
    });
  } finally {
    editor.destroy();
    awareness.destroy();
    room.destroy();
    vi.useRealTimers();
  }
});
