import { Editor } from '@tiptap/core';
import { createTiptapWireExtensions } from '../wire-schema';
import { createThreeSceneExtension, KOREAN_THREE_SCENE_LABELS } from './ThreeSceneNode';

it('inserts a schema-valid block and refuses the command when read-only', () => {
  // No `element`: the editor keeps its state without an EditorView, which is all the command reads.
  const editor = new Editor({
    element: null,
    extensions: [
      ...createTiptapWireExtensions(),
      createThreeSceneExtension({
        labels: KOREAN_THREE_SCENE_LABELS,
        authoringMode: { allowNeutralBlockEdits: true, allowLocalizedBlockEdits: true },
      }),
    ],
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [{ type: 'blockContainer', attrs: { id: 'p' }, content: [{ type: 'paragraph' }] }],
        },
      ],
    },
  });
  expect(
    editor.commands.insertThreeScene({
      blockId: 'inserted',
      title: 'Night scene',
      source: 'camera.position.z = 2;',
      displaySize: '72',
    }),
  ).toBe(true);
  expect(JSON.stringify(editor.getJSON())).toContain('camera.position.z = 2;');
  expect(JSON.stringify(editor.getJSON())).toContain('Night scene');
  expect(JSON.stringify(editor.getJSON())).toContain('"displaySize":"72"');
  editor.setEditable(false);
  expect(editor.commands.insertThreeScene()).toBe(false);
  editor.destroy();
});
