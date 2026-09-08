import { mergeAttributes, Node, type Extensions } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import type { EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { DEFAULT_MERMAID_SOURCE, MERMAID_SOURCE_LIMIT } from '@/features/mermaid/mermaid-renderer';
import { isMonacoSourceEditorEvent } from '../code-editor';
import { MermaidNodeView } from './MermaidNodeView';

export interface MermaidNodeOptions {
  authoringMode?: EditorAuthoringMode | null;
}
interface InsertMermaidOptions {
  source?: string;
  title?: string;
  blockId?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaid: { insertMermaid: (options?: InsertMermaidOptions) => ReturnType };
  }
}

export function createMermaidExtension(options: MermaidNodeOptions = {}): Extensions[number] {
  return Node.create<MermaidNodeOptions>({
    name: 'mermaid',
    group: 'blockContent',
    content: 'text*',
    marks: '',
    code: true,
    atom: true,
    defining: true,
    isolating: true,
    selectable: true,
    draggable: false,
    addOptions: () => options,
    addAttributes: () => ({
      title: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-title') ?? '',
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-title': attrs.title }),
      },
    }),
    parseHTML: () => [{ tag: '[data-content-type="mermaid"]', preserveWhitespace: 'full' }],
    renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-content-type': 'mermaid' }), 0],
    addNodeView() {
      return ReactNodeViewRenderer(
        (props) => <MermaidNodeView {...props} authoringMode={this.options.authoringMode} />,
        {
          stopEvent: ({ event }) =>
            isMonacoSourceEditorEvent(event) ||
            (event.target instanceof Element && event.target.closest('[data-mermaid-editor]') !== null),
        },
      );
    },
    addCommands() {
      return {
        insertMermaid:
          (input = {}) =>
          ({ commands, editor }) => {
            const source = input.source ?? DEFAULT_MERMAID_SOURCE;
            if (
              !editor.isEditable ||
              this.options.authoringMode?.allowNeutralBlockEdits !== true ||
              !editor.schema.nodes.blockContainer ||
              source.length > MERMAID_SOURCE_LIMIT
            ) {
              return false;
            }
            return commands.insertContent({
              type: 'blockContainer',
              attrs: { id: input.blockId ?? crypto.randomUUID() },
              content: [
                {
                  type: 'mermaid',
                  attrs: { title: input.title ?? '' },
                  content: source ? [{ type: 'text', text: source }] : [],
                },
              ],
            });
          },
      };
    },
  });
}
