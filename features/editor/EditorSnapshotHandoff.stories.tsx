import { useState } from 'react';
import { useLocale } from 'next-intl';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { Button } from '@/components/core/Button';
import { EditorSnapshotHandoff } from './EditorSnapshotHandoff';
import { TiptapSnapshot } from './tiptap/TiptapSnapshot';

const content = {
  type: 'doc',
  content: [
    {
      type: 'blockGroup',
      content: [
        {
          type: 'blockContainer',
          attrs: { id: '10000000-0000-4000-8000-000000000001' },
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'The body is readable before the room connects.' }] },
          ],
        },
      ],
    },
  ],
};
function Preview({ editable = true }: { editable?: boolean }) {
  const [ready, setReady] = useState(false);
  const locale = useLocale();
  return (
    <>
      <Button onClick={() => setReady(true)}>Make room ready</Button>
      <EditorSnapshotHandoff
        ready={ready}
        editable={editable}
        snapshot={<TiptapSnapshot content={content} locale={locale} label="Body" />}
      >
        <div
          className="ProseMirror"
          contentEditable={editable}
          suppressContentEditableWarning
          role={editable ? 'textbox' : 'document'}
          aria-label="Body"
        >
          Live revision: the room corrects the snapshot.
        </div>
      </EditorSnapshotHandoff>
    </>
  );
}
const meta = {
  title: 'Feature/Editor/Snapshot Handoff',
  component: Preview,
  parameters: {
    docs: {
      description: {
        component:
          'Production handoff boundary and snapshot renderer. Room readiness and the mounted live surface are simulated; use Post and Page editor routes to verify real Tiptap geometry, focus, and collaboration.',
      },
    },
  },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WaitingThenReady: Story = {};
export const ReadOnly: Story = { args: { editable: false } };
