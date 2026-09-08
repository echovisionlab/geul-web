import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { EditorContent, useEditor } from '@tiptap/react';
import { UndoRedo } from '@tiptap/extensions';
import { createTiptapWireExtensions } from '@/features/editor/tiptap/wire-schema';
import { createMermaidExtension } from '@/features/editor/tiptap/mermaid/mermaid-extension';
import { MermaidSettingsEditor } from '@/features/page/blocks/mermaid/Editor';
import { MermaidCanvasPreview } from '@/features/page/blocks/mermaid/View';
import { MermaidEditor } from './MermaidEditor';
import { MermaidDiagram } from './MermaidDiagram';

const SOURCE = 'flowchart LR\n  Draft --> Review{Approved?}\n  Review -->|Yes| Publish\n  Review -->|No| Draft';
const meta = {
  title: 'Feature/Editor/Mermaid',
  component: MermaidEditor,
  parameters: { layout: 'padded' },
  args: { source: SOURCE, title: '' },
} satisfies Meta<typeof MermaidEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledEditor({ initialSource = SOURCE }: { initialSource?: string }) {
  const [source, setSource] = useState(initialSource);
  const [title, setTitle] = useState('');
  return <MermaidEditor source={source} title={title} onChange={setSource} onTitleChange={setTitle} />;
}

export const SourceAndPreview: Story = { render: () => <ControlledEditor /> };
export const ReadOnly: Story = { render: () => <MermaidDiagram source={SOURCE} /> };
export const InvalidSource: Story = { render: () => <ControlledEditor initialSource={'flowchart LR\n  A --> ['} /> };
export const Empty: Story = { render: () => <ControlledEditor initialSource="" /> };
export const Sequence: Story = {
  render: () => (
    <ControlledEditor
      initialSource={
        'sequenceDiagram\n  participant Editor\n  participant API\n  Editor->>API: Save\n  API-->>Editor: Saved'
      }
    />
  ),
};

function TiptapExample({ readOnly = false }: { readOnly?: boolean }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      ...createTiptapWireExtensions(),
      UndoRedo,
      createMermaidExtension({
        authoringMode: {
          allowNeutralBlockEdits: !readOnly,
          allowLocalizedBlockEdits: !readOnly,
        },
      }),
    ],
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'mermaid-story-block' },
              content: [{ type: 'mermaid', attrs: { title: '' }, content: [{ type: 'text', text: SOURCE }] }],
            },
            { type: 'blockContainer', attrs: { id: 'mermaid-story-paragraph' }, content: [{ type: 'paragraph' }] },
          ],
        },
      ],
    },
  });
  return <EditorContent editor={editor} />;
}
export const TiptapBlock: Story = { render: () => <TiptapExample /> };
export const TiptapReadOnly: Story = { render: () => <TiptapExample readOnly /> };

function PageExample({ translation = false }: { translation?: boolean }) {
  const [props, setProps] = useState({ source: SOURCE, title: '' });
  return (
    <MermaidSettingsEditor
      sectionId="mermaid-story-page"
      props={props}
      allowSharedEdits={!translation}
      updateSharedProps={(next) => setProps((current) => ({ ...current, ...next }))}
      updateLocalizedProps={(next) => setProps((current) => ({ ...current, ...next }))}
    />
  );
}
export const PageBlock: Story = { render: () => <PageExample /> };
export const PageCanvas: Story = {
  render: () => <MermaidCanvasPreview sectionId="mermaid-story-page" props={{ source: SOURCE }} settings={{}} />,
};

export const PageTranslation: Story = { render: () => <PageExample translation /> };
