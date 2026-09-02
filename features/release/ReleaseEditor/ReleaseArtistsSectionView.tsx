'use client';

import { useState } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconGripVertical, IconPlus, IconX } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box, Group, Modal, Stack, Table, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Select } from '@/components/core/Input';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import type { ReleaseArtistItem } from '@/lib/types/release/model';

export interface ReleaseArtistOption {
  id: string;
  name: string;
  slug: string | null;
}

interface ReleaseArtistsSectionViewProps {
  idPrefix?: string;
  artists: ReleaseArtistItem[];
  options: ReleaseArtistOption[];
  onChange: (artists: ReleaseArtistItem[]) => void;
}

export function ReleaseArtistsSectionView({ idPrefix, artists, options, onChange }: ReleaseArtistsSectionViewProps) {
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

  const normalizeAndChange = (nextArtists: ReleaseArtistItem[]) => {
    onChange(nextArtists.map((artist, index) => ({ ...artist, sort_order: index })));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = artists.findIndex((artist) => artist.artist_id === active.id);
    const newIndex = artists.findIndex((artist) => artist.artist_id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      normalizeAndChange(arrayMove(artists, oldIndex, newIndex));
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
      <Stack>
        <SectionHeader
          title={tCommon('entities.artists')}
          actions={
            <Button
              id={idPrefix ? `${idPrefix}-add-button` : undefined}
              emphasis="medium"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={open}
            >
              {tCommon('actions.addItem', { item: tCommon('entities.artist') })}
            </Button>
          }
        />

        {artists.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t('empty')}
          </Text>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={artists.map((artist) => artist.artist_id)} strategy={verticalListSortingStrategy}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={40} />
                    <Table.Th>{tCommon('entities.artist')}</Table.Th>
                    <Table.Th w={50} />
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
      </Stack>

      <Modal opened={opened} onClose={closeModal} title={t('modal.title')}>
        <Stack>
          <Select
            id={idPrefix ? `${idPrefix}-select` : undefined}
            label={tCommon('entities.artist')}
            placeholder={t('placeholders.selectArtist')}
            data={availableOptions.map((option) => ({ value: option.id, label: option.name }))}
            value={selectedArtistId}
            onChange={setSelectedArtistId}
            searchable
          />
          <Group justify="flex-end">
            <Button emphasis="low" onClick={closeModal}>
              {tCommon('actions.cancel')}
            </Button>
            <Button onClick={handleAdd} disabled={!selectedArtistId}>
              {tCommon('actions.add')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </SectionCard>
  );
}

function SortableArtistRow({ artist, onRemove }: { artist: ReleaseArtistItem; onRemove: () => void }) {
  const tCommon = useTranslations('common');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: artist.artist_id,
  });

  return (
    <Table.Tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <Table.Td>
        <Box {...attributes} {...listeners} style={{ cursor: 'grab' }}>
          <IconGripVertical size={14} color="gray" />
        </Box>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{artist.artist_name}</Text>
      </Table.Td>
      <Table.Td>
        <IconButton tone="danger" emphasis="low" size="sm" aria-label={tCommon('actions.remove')} onClick={onRemove}>
          <IconX size={14} />
        </IconButton>
      </Table.Td>
    </Table.Tr>
  );
}
