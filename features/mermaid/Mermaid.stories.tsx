import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, waitFor, within } from 'storybook/test';
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
  title: 'Feature/Mermaid/Diagram',
  component: MermaidEditor,
  parameters: { canvasInset: 'none', layout: 'padded' },
  args: { source: SOURCE, title: '' },
} satisfies Meta<typeof MermaidEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledEditor({ initialSource = SOURCE }: { initialSource?: string }) {
  const [source, setSource] = useState(initialSource);
  const [title, setTitle] = useState('');
  return <MermaidEditor source={source} title={title} onChange={setSource} onTitleChange={setTitle} />;
}

export const SourceAndPreview: Story = {
  render: () => <ControlledEditor />,
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Mermaid' });
    await waitFor(() => expect(within(group).getByRole('img', { name: 'Mermaid' })).toBeVisible());
    const source = await waitFor(() => {
      const input = group.querySelector<HTMLElement>('[role="textbox"]');
      expect(input).not.toBeNull();
      return input!;
    });
    source.focus();
    await userEvent.keyboard('{Tab}');
    const caption = group.querySelector<HTMLInputElement>('input')!;
    await waitFor(() => expect(caption).toHaveFocus());
    expect(caption).toHaveAttribute('aria-label', caption.placeholder);
    await userEvent.type(caption, 'Author diagram');
    expect(group).toHaveAttribute('aria-label', 'Author diagram');
    await waitFor(() => expect(within(group).getByRole('img', { name: 'Author diagram' })).toBeVisible());
  },
};
export const ReadOnly: Story = { render: () => <MermaidDiagram source={SOURCE} /> };
export const AccessibleDescription: Story = {
  render: () => (
    <MermaidDiagram
      title="Publication workflow"
      source={
        'flowchart LR\n accTitle: Draft review and publication\n accDescr: Drafts enter review. Approved drafts are published; rejected drafts return to drafting.\n Draft --> Review{Approved?}\n Review -->|Yes| Publish\n Review -->|No| Draft'
      }
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The visible caption names one accessible diagram. Authored accTitle and accDescr remain available as its description when they add information. The SVG pixels and visible caption are preserved.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const image = await waitFor(() => {
      const image = within(canvasElement).getByRole('img', { name: 'Publication workflow' });
      expect(image).toHaveAttribute('data-mermaid-status', 'ready');
      return image;
    });
    expect(within(canvasElement).getAllByRole('img')).toHaveLength(1);
    expect(image).toHaveAccessibleDescription(
      'Draft review and publication Drafts enter review. Approved drafts are published; rejected drafts return to drafting.',
    );
    expect(image.querySelector('img')).toHaveAttribute('alt', '');
    const caption = canvasElement.ownerDocument.getElementById(image.getAttribute('aria-labelledby')!);
    expect(caption).toHaveTextContent('Publication workflow');
    expect(image).toContainElement(caption);
  },
};
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

export const EntityRelationship: Story = {
  render: () => (
    <MermaidDiagram
      source={
        'erDiagram\n  DOCUMENT ||--o{ REVISION : contains\n  DOCUMENT {\n    string title\n    string locale\n  }\n  REVISION {\n    string author\n    datetime created\n  }'
      }
    />
  ),
};

export const State: Story = {
  render: () => (
    <MermaidDiagram
      source={'stateDiagram-v2\n  [*] --> Draft\n  Draft --> Review\n  Review --> Published\n  Published --> [*]'}
    />
  ),
};

export const Schedule: Story = {
  render: () => (
    <MermaidDiagram
      source={
        'gantt\n  dateFormat YYYY-MM-DD\n  section Publication\n  Draft :done, draft, 2026-10-01, 3d\n  Review :active, review, after draft, 3d\n  Publish :crit, publish, after review, 1d'
      }
    />
  ),
};

export const Pie: Story = {
  render: () => <MermaidDiagram source={'pie\n  "Draft" : 3\n  "Review" : 2\n  "Published" : 5'} />,
};

export const Chart: Story = {
  render: () => (
    <MermaidDiagram
      source={
        'xychart-beta\n  x-axis [Mon, Tue, Wed, Thu, Fri]\n  y-axis "Documents" 0 --> 10\n  bar [2, 4, 3, 7, 9]\n  line [1, 3, 5, 6, 8]'
      }
    />
  ),
};

export const Timeline: Story = {
  render: () => (
    <MermaidDiagram source={'timeline\n  2026-10-01 : Draft\n  2026-10-04 : Review\n  2026-10-07 : Published'} />
  ),
};

export const AuthoredStyle: Story = {
  render: () => (
    <MermaidDiagram
      source={
        'flowchart LR\n  Draft --> Published\n  classDef authored fill:#336699,color:#ffffff,stroke:#224466\n  class Published authored'
      }
    />
  ),
};

function TiptapExample({ readOnly = false }: { readOnly?: boolean }) {
  const locale = useLocale();
  const common = useTranslations('common.labels');
  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    editorProps: {
      attributes: {
        role: readOnly ? 'document' : 'textbox',
        'aria-label': common('content'),
        ...(!readOnly ? { 'aria-multiline': 'true' } : {}),
        lang: locale,
      },
    },
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
export const TiptapReadOnly: Story = {
  render: () => <TiptapExample readOnly />,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(within(canvasElement).getByRole('img', { name: 'Mermaid' })).toBeVisible());
    expect(within(canvasElement).queryByRole('button')).toBeNull();
    const wrapper = canvasElement.querySelector('[data-content-type="mermaid"] > div');
    expect(wrapper).not.toHaveAttribute('aria-label');
  },
};

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
  render: () => (
    <MermaidCanvasPreview
      sectionId="mermaid-story-page"
      props={{ source: SOURCE }}
      settings={{
        backgroundColor: '',
        paddingTop: '0',
        paddingBottom: '0',
        paddingLeft: '0',
        paddingRight: '0',
        maxWidth: 'container',
      }}
    />
  ),
};

export const PageTranslation: Story = { render: () => <PageExample translation /> };
