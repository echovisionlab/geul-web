'use client';
import { useReleaseEditorCanEdit } from './ReleaseEditorAccessContext';
import { SupportingText, Text as DsText } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import { useId, useState } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortableItem } from '@/components/core/Sortable';
import { IconGripVertical, IconPlus, IconX } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Table } from '@/components/core/Display';
import { ContentModal, DialogActions } from '@/components/core/Modal';
import { useDisclosure } from '@mantine/hooks';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Select } from '@/components/core/Input';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import type { ReleaseArtistItem } from '@/lib/types/release/model';
import { reorderWithIntent } from './reorder-with-intent';
export interface ReleaseArtistOption {
  id: string;
  name: string;
  slug: string | null;
}
interface ReleaseArtistsSectionViewProps {
  idPrefix?: string;
  artists: ReleaseArtistItem[];
  options: ReleaseArtistOption[];
  onChange: (
    artists: ReleaseArtistItem[],
    orderIntent?: {
      itemId: string;
      previousItemId?: string;
      nextItemId?: string;
    },
  ) => void;
}
export function ReleaseArtistsSectionView({ idPrefix, artists, options, onChange }: ReleaseArtistsSectionViewProps) {
  const tModalActions = useTranslations('common.actions');
  const canEdit = useReleaseEditorCanEdit();
  const tCommon = useTranslations('common');
  const t = useTranslations('releaseEditor.artists');
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const availableOptions = options.filter((option) => !artists.some((artist) => artist.artist_id === option.id));
  const closeModal = () => {
    setSelectedArtistId(null);
    close();
  };
  const normalizeAndChange = (
    nextArtists: ReleaseArtistItem[],
    orderIntent?: {
      itemId: string;
      previousItemId?: string;
      nextItemId?: string;
    },
  ) => {
    if (!canEdit) {
      return;
    }
    onChange(
      nextArtists.map((artist, index) => ({ ...artist, sort_order: index })),
      orderIntent,
    );
  };
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!canEdit) {
      return;
    }
    const reorder = reorderWithIntent(artists, active.id, over?.id, (artist) => artist.artist_id);
    if (reorder) {
      normalizeAndChange(reorder.items, reorder.intent);
    }
  };
  const handleAdd = () => {
    const option = options.find((candidate) => candidate.id === selectedArtistId);
    if (!option) {
      return;
    }
    normalizeAndChange([
      ...artists,
      {
        artist_id: option.id,
        artist_name: option.name,
        artist_slug: option.slug,
        sort_order: artists.length,
      },
    ]);
    closeModal();
  };
  return (
    <SectionCard>
      <DsLayoutStack>
        <SectionHeader
          title={tCommon('entities.artists')}
          actions={
            <Button
              id={idPrefix ? `${idPrefix}-add-button` : undefined}
              emphasis="medium"
              size="xs"
              leftSection={<IconPlus size={14} />}
              disabled={!canEdit}
              onClick={open}
            >
              {tCommon('actions.addItem', { item: tCommon('entities.artist') })}
            </Button>
          }
        />

        {artists.length === 0 ? (
          <SupportingText tone="secondary">{t('empty')}</SupportingText>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={artists.map((artist) => artist.artist_id)} strategy={verticalListSortingStrategy}>
              <Table density="compact">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th />
                    <Table.Th>{tCommon('entities.artist')}</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {artists.map((artist) => (
                    <SortableArtistRow
                      key={artist.artist_id}
                      artist={artist}
                      onRemove={() => normalizeAndChange(artists.filter((item) => item.artist_id !== artist.artist_id))}
                    />
                  ))}
                </Table.Tbody>
              </Table>
            </SortableContext>
          </DndContext>
        )}
      </DsLayoutStack>

      <ContentModal opened={opened} onClose={closeModal} title={t('modal.title')} closeLabel={tModalActions('close')}>
        <DsLayoutStack>
          <Select
            disabled={!canEdit}
            id={idPrefix ? `${idPrefix}-select` : undefined}
            label={tCommon('entities.artist')}
            placeholder={t('placeholders.selectArtist')}
            data={availableOptions.map((option) => ({ value: option.id, label: option.name }))}
            value={selectedArtistId}
            onChange={setSelectedArtistId}
            searchable
          />
          <DialogActions>
            <Button emphasis="low" onClick={closeModal}>
              {tCommon('actions.cancel')}
            </Button>
            <Button tone="neutral" emphasis="strong" onClick={handleAdd} disabled={!canEdit || !selectedArtistId}>
              {tCommon('actions.add')}
            </Button>
          </DialogActions>
        </DsLayoutStack>
      </ContentModal>
    </SectionCard>
  );
}
export function SortableArtistRow({ artist, onRemove }: { artist: ReleaseArtistItem; onRemove: () => void }) {
  const artistNameId = useId();
  const canEdit = useReleaseEditorCanEdit();
  const tCommon = useTranslations('common');
  const tSort = useTranslations('dataTable.sort');
  const sortable = useSortableItem({
    id: artist.artist_id,
    disabled: !canEdit,
  });
  return (
    <Table.Tr ref={sortable.setNodeRef} dragState={sortable.dragState}>
      <Table.Td>
        <IconButton
          emphasis="low"
          interaction="drag-handle"
          draggable={false}
          {...sortable.handle}
          disabled={!canEdit}
          aria-label={tSort('aria.reorder', { label: artist.artist_name })}
        >
          <IconGripVertical aria-hidden />
        </IconButton>
      </Table.Td>
      <Table.Td>
        <DsText id={artistNameId} size="sm">
          {artist.artist_name}
        </DsText>
      </Table.Td>
      <Table.Td>
        <IconButton
          tone="danger"
          emphasis="low"
          size="compact"
          aria-label={tCommon('actions.remove')}
          aria-describedby={artistNameId}
          disabled={!canEdit}
          onClick={onRemove}
        >
          <IconX size={14} />
        </IconButton>
      </Table.Td>
    </Table.Tr>
  );
}
