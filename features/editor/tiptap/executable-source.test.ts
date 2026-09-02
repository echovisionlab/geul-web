import { Editor } from '@tiptap/core';
import { createP5SketchExtension } from './p5';
import { KOREAN_P5_SKETCH_LABELS } from './p5/p5-labels.fixtures';
import { createTiptapWireExtensions } from './wire-schema';
import { replaceExecutableSource } from './executable-source';

function mount() {
  const editor = new Editor({
    extensions: [...createTiptapWireExtensions(), createP5SketchExtension({ labels: KOREAN_P5_SKETCH_LABELS })],
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'p5' },
              content: [{ type: 'p5Sketch', content: [{ type: 'text', text: 'abc' }] }],
            },
          ],
        },
      ],
    },
  });
  const getPos = () => 2;
  const node = editor.state.doc.nodeAt(2)!;
  return { editor, getPos, node };
}

describe('replaceExecutableSource', () => {
  it('diffs consecutive edits against the current document instead of a stale NodeView render', () => {
    const mounted = mount();
    expect(replaceExecutableSource(mounted, 'abcd')).toBe(true);
    expect(replaceExecutableSource(mounted, 'abcde')).toBe(true);
    expect(mounted.editor.state.doc.nodeAt(2)?.textContent).toBe('abcde');
    mounted.editor.destroy();
  });

  it('preserves a remote edit that landed before the next Monaco change', () => {
    const mounted = mount();
    mounted.editor.view.dispatch(mounted.editor.state.tr.insertText('X', 4, 4));
    expect(mounted.editor.state.doc.nodeAt(2)?.textContent).toBe('aXbc');
    expect(replaceExecutableSource(mounted, 'aXbc!')).toBe(true);
    expect(mounted.editor.state.doc.nodeAt(2)?.textContent).toBe('aXbc!');
    mounted.editor.destroy();
  });
});
