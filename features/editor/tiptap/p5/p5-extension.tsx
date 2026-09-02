import { mergeAttributes, Node, type CommandProps, type Extensions } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { isMonacoSourceEditorEvent } from '../code-editor';
import { P5SketchNodeView } from './P5SketchNodeView';
import { createP5AttributeDefinitions, createP5BlockId, normalizeP5NodeAttributes } from './p5-node-attributes';
import { requireP5SketchLabels, type P5SketchOptions, type InsertP5SketchOptions } from './p5-node-options';
import { DEFAULT_P5_SKETCH_SOURCE } from './p5-source';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    p5Sketch: {
      insertP5Sketch: (options?: InsertP5SketchOptions) => ReturnType;
    };
  }
}

export function createP5SketchExtension(options: P5SketchOptions = {}): Extensions[number] {
  const resolvedOptions: P5SketchOptions = {
    ...options,
    labels: requireP5SketchLabels(options.labels),
  };
  return Node.create<P5SketchOptions>({
    name: 'p5Sketch',
    group: 'blockContent',
    content: 'text*',
    marks: '',
    code: true,
    atom: true,
    defining: true,
    isolating: true,
    selectable: true,
    draggable: false,
    addOptions: () => resolvedOptions,
    addAttributes() {
      return createP5AttributeDefinitions();
    },
    parseHTML() {
      return [{ tag: '[data-content-type="p5Sketch"]' }];
    },
    renderHTML({ HTMLAttributes }) {
      return ['div', mergeAttributes(HTMLAttributes, { 'data-content-type': 'p5Sketch' }), 0];
    },
    addNodeView() {
      return ReactNodeViewRenderer((props) => <P5SketchNodeView {...props} {...this.options} />, {
        stopEvent: ({ event }) => isMonacoSourceEditorEvent(event),
      });
    },
    addCommands() {
      return {
        insertP5Sketch:
          (input = {}) =>
          ({ commands, editor }: CommandProps) => {
            if (
              !editor.isEditable ||
              this.options.authoringMode?.allowNeutralBlockEdits !== true ||
              !editor.schema.nodes.blockContainer ||
              !editor.schema.nodes.p5Sketch
            ) {
              return false;
            }
            return commands.insertContent({
              type: 'blockContainer',
              attrs: { id: input.blockId ?? createP5BlockId() },
              content: [
                {
                  type: 'p5Sketch',
                  attrs: normalizeP5NodeAttributes(input),
                  content: [{ type: 'text', text: input.source ?? DEFAULT_P5_SKETCH_SOURCE }],
                },
              ],
            });
          },
      };
    },
  });
}
