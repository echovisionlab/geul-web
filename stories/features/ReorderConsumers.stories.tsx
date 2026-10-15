import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortableSensors } from '@/lib/hooks/useSortableSensors';
import { LayoutStack, LayoutInline, LayoutContainer } from '@/components/core/Layout';
import { Table } from '@/components/core/Display';
import { SortableCreditRow } from '@/features/work/WorkEditor/credits/SortableCreditRow';
import { SortableCreditGroupHeader } from '@/features/work/WorkEditor/credits/SortableCreditGroupHeader';
import { SortableClient } from '@/features/work/WorkEditor/WorkClientsSection';
import { SortableArtistRow } from '@/features/release/ReleaseEditor/ReleaseArtistsSectionView';
import { SortableLabelRow } from '@/features/release/ReleaseEditor/ReleaseLabelsSection';
import { SortableCreditRow as ReleaseCreditRow } from '@/features/release/ReleaseEditor/ReleaseCreditsSection';
import { SortablePosterCard } from '@/features/program-event/ProgramEventEditor/ProgramEventPosterUploader';
import { SortableTextMarqueeItemRow } from '@/features/page/blocks/text-marquee/Editor';

/** Real production renderers with local order/edit callbacks; no collaborative/server simulation. */
function LocalSort({
  ids,
  onChange,
  children,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
  children: ReactNode;
}) {
  const sensors = useSortableSensors({ activationDistance: 5 });
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (over && active.id !== over.id) {
          onChange(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
        }
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}
function CreditRows() {
  const [ids, setIds] = useState(['credit-one', 'credit-two', 'credit-three']);
  const [roles, setRoles] = useState<Record<string, string | null>>({
    'credit-one': 'Field recording',
    'credit-two': 'Mastering',
  });
  return (
    <LocalSort ids={ids} onChange={setIds}>
      <LayoutStack gap="none">
        {ids.map((id, index) => (
          <SortableCreditRow
            key={id}
            credit={{
              id: id.slice(7),
              groupId: null,
              name: { 'credit-one': 'June Han', 'credit-two': 'Listening room', 'credit-three': 'Archive' }[id] ?? id,
              creditRole: roles[id] ?? null,
              artist: null,
              member: null,
              sortOrder: index,
            }}
            groupId={null}
            canEdit
            onRemove={() => setIds(ids.filter((i) => i !== id))}
            onEditRole={(_, role) => setRoles({ ...roles, [id]: role })}
            isRemoving={false}
            isUpdating={false}
          />
        ))}
      </LayoutStack>
    </LocalSort>
  );
}
function CreditGroups() {
  const [ids, setIds] = useState(['group-one', 'group-two']);
  const [names, setNames] = useState<Record<string, string>>({ 'group-one': 'Recording', 'group-two': 'Production' });
  return (
    <LocalSort ids={ids} onChange={setIds}>
      <LayoutStack gap="none">
        {ids.map((id, index) => (
          <SortableCreditGroupHeader
            key={id}
            group={{ id: id.slice(6), workId: 'local', name: names[id], sortOrder: index }}
            canEdit
            onEdit={(_, name) => setNames({ ...names, [id]: name })}
            onDelete={() => setIds(ids.filter((i) => i !== id))}
            isDeleting={false}
          />
        ))}
      </LayoutStack>
    </LocalSort>
  );
}
function ClientRows() {
  const [ids, setIds] = useState(['Listening room', 'Archive']);
  return (
    <LocalSort ids={ids} onChange={setIds}>
      <LayoutStack gap="none">
        {ids.map((id) => (
          <SortableClient
            key={id}
            clientId={id}
            client={{ id, name: id, logoUrl: null, website: 'https://example.com' }}
            canEdit
            onRemove={() => setIds(ids.filter((i) => i !== id))}
            isLoading={false}
            reorderAriaLabel={`Reorder ${id}`}
            openWebsiteAriaLabel={`Open ${id}`}
            removeAriaLabel={`Remove ${id}`}
          />
        ))}
      </LayoutStack>
    </LocalSort>
  );
}
function ReleaseRows({ kind }: { kind: 'artist' | 'label' | 'credit' }) {
  const [ids, setIds] = useState(['one', 'two']);
  const [notes, setNotes] = useState<Record<string, string>>({ one: 'EVL-001', two: 'EVL-002' });
  const remove = (id: string) => setIds(ids.filter((i) => i !== id));
  return (
    <LocalSort ids={ids} onChange={setIds}>
      <Table density="compact">
        <Table.Tbody>
          {ids.map((id, index) =>
            kind === 'artist' ? (
              <SortableArtistRow
                key={id}
                artist={{
                  artist_id: id,
                  artist_name: id === 'two' ? 'Listening room' : 'June Han',
                  artist_slug: null,
                  sort_order: index,
                }}
                onRemove={() => remove(id)}
              />
            ) : kind === 'label' ? (
              <SortableLabelRow
                key={id}
                label={{
                  label_id: id,
                  label_name: id === 'two' ? 'Archive' : 'Echo Vision',
                  label_slug: null,
                  catalog_number: notes[id],
                  sort_order: index,
                }}
                onRemove={() => remove(id)}
                onCatalogNumberChange={(value) => setNotes({ ...notes, [id]: value })}
              />
            ) : (
              <ReleaseCreditRow
                key={id}
                credit={{
                  id,
                  credit_type: 'text',
                  artist_id: null,
                  artist_name: null,
                  artist_slug: null,
                  member_id: null,
                  member_name: null,
                  credited_name: id === 'two' ? 'Listening room' : 'June Han',
                  credit_role: 'Production',
                  sort_order: index,
                }}
                note={notes[id]}
                canEdit
                canEditNote
                onRemove={() => remove(id)}
                onNoteChange={(value) => setNotes({ ...notes, [id]: value })}
                getCreditDisplayName={(credit) => credit.credited_name ?? ''}
              />
            ),
          )}
        </Table.Tbody>
      </Table>
    </LocalSort>
  );
}
function PosterRows() {
  const [ids, setIds] = useState(['one', 'two']);
  return (
    <LocalSort ids={ids} onChange={setIds}>
      <LayoutInline gap="xxs" wrap="nowrap">
        {ids.map((id, index) => (
          <div key={id} style={{ width: 160, maxWidth: '50%' }}>
            <SortablePosterCard
              item={{
                id,
                fileId: id,
                url: '/storybook/media/video-poster.jpg',
                role: 'poster',
                sortOrder: index,
                isPrimary: index === 0,
                alt: 'Poster',
                caption: null,
              }}
              canEdit
              disabled={false}
              labels={{ drag: `Reorder ${id}`, main: 'Main', noPreview: 'No preview', remove: `Remove ${id}` }}
              onRemove={() => setIds(ids.filter((i) => i !== id))}
            />
          </div>
        ))}
      </LayoutInline>
    </LocalSort>
  );
}
function MarqueeRows() {
  const [ids, setIds] = useState(['one', 'two']);
  const [items, setItems] = useState<Record<string, { text: string; href: string }>>({
    one: { text: 'Listening room', href: '/room' },
    two: { text: 'Archive', href: '/archive' },
  });
  return (
    <LocalSort ids={ids} onChange={setIds}>
      <LayoutStack gap="none">
        {ids.map((id, index) => (
          <SortableTextMarqueeItemRow
            key={id}
            id={id}
            index={index}
            item={items[id]!}
            textLabel="Text"
            hrefLabel="Link"
            dragLabel={`Reorder ${id}`}
            removeLabel={`Remove ${id}`}
            onChange={(_, value) => setItems({ ...items, [id]: value })}
            onRemove={(i) => setIds(ids.filter((_, index) => index !== i))}
          />
        ))}
      </LayoutStack>
    </LocalSort>
  );
}

const meta = {
  title: 'Feature/Interaction/Reorder Consumers',
  parameters: { canvasInset: 'none', layout: 'padded' },
  decorators: [
    (Story: () => ReactNode) => (
      <LayoutContainer size="compact">
        <Story />
      </LayoutContainer>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const WorkCredits: Story = { render: () => <CreditRows /> };
export const WorkGroups: Story = { render: () => <CreditGroups /> };
export const WorkClients: Story = { render: () => <ClientRows /> };
export const ReleaseArtists: Story = { render: () => <ReleaseRows kind="artist" /> };
export const ReleaseLabels: Story = { render: () => <ReleaseRows kind="label" /> };
export const ReleaseCredits: Story = { render: () => <ReleaseRows kind="credit" /> };
export const Posters: Story = { render: () => <PosterRows /> };
export const TextMarquee: Story = { render: () => <MarqueeRows /> };
