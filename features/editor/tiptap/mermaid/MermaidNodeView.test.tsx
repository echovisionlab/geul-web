// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTiptapWireExtensions } from '../wire-schema';
import { createMermaidExtension } from './mermaid-extension';

vi.mock('@/features/mermaid/MermaidDiagram', () => ({
  MermaidDiagram: ({ title }: { title?: string }) => <figure aria-label={title || 'Mermaid'}>{title}</figure>,
}));
vi.mock('@/features/mermaid/MermaidEditor', () => ({
  MermaidEditor: ({ source }: { source: string }) => <textarea aria-label="Diagram source" readOnly value={source} />,
}));

const mounted: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const dispose of mounted.splice(0)) {
    await dispose();
  }
});

async function mountDiagram(editable: boolean) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const reference: { editor: Editor | null } = { editor: null };
  const extensions = [
    ...createTiptapWireExtensions(),
    createMermaidExtension({ authoringMode: { allowNeutralBlockEdits: true, allowLocalizedBlockEdits: true } }),
  ];
  function Fixture() {
    const editor = useEditor({
      immediatelyRender: false,
      extensions,
      editable,
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [
              {
                type: 'blockContainer',
                attrs: { id: 'diagram' },
                content: [
                  {
                    type: 'mermaid',
                    attrs: { title: 'Publication workflow' },
                    content: [{ type: 'text', text: 'flowchart LR\nDraft --> Publish' }],
                  },
                ],
              },
              { type: 'blockContainer', attrs: { id: 'after' }, content: [{ type: 'paragraph' }] },
            ],
          },
        ],
      },
    });
    reference.editor = editor;
    return <EditorContent editor={editor} />;
  }
  await act(async () => root.render(<Fixture />));
  await act(async () => {
    reference.editor!.state.doc.descendants((node, position) => {
      if (node.type.name === 'paragraph') {
        reference.editor!.commands.setTextSelection(position + 1);
      }
    });
  });
  mounted.push(async () => {
    await act(async () => {
      root.unmount();
      await new Promise((resolve) => setTimeout(resolve, 2));
    });
    host.remove();
  });
  return { host, editor: reference.editor! };
}

describe('Mermaid block accessibility', () => {
  it('keeps the caption in its edit trigger name and enters the exact block with the keyboard', async () => {
    const { host, editor } = await mountDiagram(true);
    expect(host.querySelector('[role="button"]')).toBeNull();
    const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="Publication workflow"]')!;
    expect(trigger.type).toBe('button');
    // A native button turns Enter/Space into click; the trigger selects the exact block.
    await act(async () => trigger.click());
    expect(editor.state.selection.from).toBe(2);
    expect(host.querySelector('textarea')).toHaveValue('flowchart LR\nDraft --> Publish');
  });

  it('exposes the figure and caption without an unsupported generic label or an edit button when read-only', async () => {
    const { host } = await mountDiagram(false);
    expect(host.querySelector('[role="button"], button')).toBeNull();
    expect(host.querySelector('[data-content-type="mermaid"] > div')).not.toHaveAttribute('aria-label');
    expect(host.querySelector('figure')).toHaveAttribute('aria-label', 'Publication workflow');
    expect(host.textContent).toContain('Publication workflow');
  });
});
