import type { JSONContent } from '@tiptap/core';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { expect, it } from 'vitest';
import * as Y from 'yjs';
import { createBlockRoomProseMirrorBridge } from './block-room-prosemirror-bridge';
import { createPostBlockRoomTiptapController } from './block-room-tiptap-controller';
import { allKindsDocument, authoredMathLatex } from './block-room-tiptap-controller.fixtures';

it('projects every generated Post rich-text kind without dropping executable or attachment payloads', ({
  onTestFinished,
}) => {
  const room = new Y.Doc();
  onTestFinished(() => room.destroy());
  hydrateCanonicalBlockRoom(room, 'post', 'ko', allKindsDocument(), []);
  const allKindsBridge = createBlockRoomProseMirrorBridge({ document: room, documentType: 'post', locale: 'ko' });
  const controller = createPostBlockRoomTiptapController(allKindsBridge);
  const blocks = (controller.initialContent as JSONContent).content?.[0]?.content ?? [];
  expect(blocks.map((block) => block.content?.[0]?.type)).toEqual([
    'paragraph',
    'heading',
    'bulletListItem',
    'numberedListItem',
    'checkListItem',
    'quote',
    'codeBlock',
    'divider',
    'table',
    'p5Sketch',
    'threeScene',
    'shader',
    'math',
    'map',
    'file',
    'callout',
  ]);
  expect(blocks[0]?.content?.[0]?.attrs?.textAlignment).toBe('center');
  expect(blocks[9]?.content?.[0]?.content?.[0]?.text).toBe('p5-source');
  expect(blocks[10]?.content?.[0]?.content?.[0]?.text).toBe('three-source');
  expect(blocks[11]?.content?.[0]?.content).toHaveLength(9);
  expect(blocks[12]?.content?.[0]?.attrs?.latex).toBe(authoredMathLatex);
  expect(blocks[14]?.content?.[0]?.attrs?.fileId).toBe('20000000-0000-4000-8000-000000000001');
  expect(blocks[15]?.content?.[0]?.attrs).toMatchObject({ icon: '⚠️', backgroundColor: 'yellow' });
});
