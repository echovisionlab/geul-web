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
import { IconGripVertical, IconPencil, IconPlus, IconX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Group, Modal, Stack, Table, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Select, TextInput } from '@/components/core/Input';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { setReleaseLabelsAction } from '@/lib/actions/release';
import { publishEditorEntityChange } from '@/lib/editor/editor-entity-changes';
import { listLabelsForSelector } from '@/lib/queries/label-browser';
import type { ReleaseLabelItem } from '@/lib/types/release/model';

interface ReleaseLabelsSectionProps {
  releaseId: string;
  idPrefix?: string;
  labels: ReleaseLabelItem[];
  onLabelsChange: (labels: ReleaseLabelItem[]) => void;
  onMutationStart?: () => void;
  onMutationSettled?: (succeeded: boolean) => void;
}

export function ReleaseLabelsSection({
  releaseId,
  idPrefix,
  labels,
  onLabelsChange,
  onMutationStart,
  onMutationSettled,
}: ReleaseLabelsSectionProps) {
  const tCommon = useTranslations('common');
  const t = useTranslations('releaseEditor.labels');
  const [addModalOpened, { open: openAddModal, close: closeAddModal }] = useDisclosure(false);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [catalogNumber, setCatalogNumber] = useState('');

  const { data: allLabels } = useQuery({
    queryKey: ['label', 'list'],
    queryFn: () => listLabelsForSelector(),
  });

  const setLabels = useMutation({
    mutationFn: ({
      nextLabels,
      orderIntent,
    }: {
      nextLabels: { labelId: string; catalogNumber?: string; sortOrder: number }[];
      orderIntent?: { itemId: string; previousItemId?: string; nextItemId?: string };
    }) =>
      setReleaseLabelsAction(
        releaseId,
        nextLabels,
        labels.map((label, sortOrder) => ({
          labelId: label.label_id,
          catalogNumber: label.catalog_number || undefined,
          sortOrder,
        })),
        orderIntent,
      ),
    onMutate: () => onMutationStart?.(),
    onSettled: (result, error) => onMutationSettled?.(!error && !result?.error),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      publishEditorEntityChange(`release:${releaseId}`);
      notifications.show({
        message: tCommon('messages.itemUpdated', { item: tCommon('entities.labels') }),
        color: 'green',
      });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persistLabels = (
    nextLabels: ReleaseLabelItem[],
    orderIntent?: { itemId: string; previousItemId?: string; nextItemId?: string },
  ) => {
    onLabelsChange(nextLabels);
    setLabels.mutate({
      nextLabels: nextLabels.map((label, sortOrder) => ({
        labelId: label.label_id,
        catalogNumber: label.catalog_number || undefined,
        sortOrder,
      })),
      orderIntent,
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = labels.findIndex((l) => l.label_id === active.id);
    const newIndex = labels.findIndex((l) => l.label_id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newLabels = arrayMove(labels, oldIndex, newIndex);
      const movedIndex = newLabels.findIndex((label) => label.label_id === active.id);
      persistLabels(newLabels, {
        itemId: String(active.id),
        previousItemId: movedIndex > 0 ? newLabels[movedIndex - 1].label_id : undefined,
        nextItemId: movedIndex + 1 < newLabels.length ? newLabels[movedIndex + 1].label_id : undefined,
      });
    }
  };

  const availableLabels = allLabels?.filter((label) => !labels.some((l) => l.label_id === label.id));

  const handleAdd = () => {
    if (!selectedLabelId) {
      return;
    }

    const label = allLabels?.find((l) => l.id === selectedLabelId);
    if (!label) {
      return;
    }

    const newLabels: ReleaseLabelItem[] = [
      ...labels,
      {
        label_id: label.id,
        label_name: label.name,
        label_slug: label.slug,
        catalog_number: catalogNumber || null,
        sort_order: labels.length,
      },
    ];

    persistLabels(newLabels);

    closeAddModal();
    setSelectedLabelId(null);
    setCatalogNumber('');
  };

  const handleRemove = (labelId: string) => {
    const newLabels = labels.filter((l) => l.label_id !== labelId);
    persistLabels(newLabels);
  };

  return (
    <SectionCard>
      <Stack>
        <SectionHeader
          title={tCommon('entities.labels')}
          actions={
            <Button
              id={idPrefix ? `${idPrefix}-add-button` : undefined}
              emphasis="medium"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={openAddModal}
            >
              {tCommon('actions.addItem', { item: tCommon('entities.label') })}
            </Button>
          }
        />

        {labels.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t('empty')}
          </Text>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={labels.map((l) => l.label_id)} strategy={verticalListSortingStrategy}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={40} />
                    <Table.Th>{tCommon('entities.label')}</Table.Th>
                    <Table.Th>{tCommon('labels.catalogNumber')}</Table.Th>
                    <Table.Th w={50} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {labels.map((label) => (
                    <SortableLabelRow
                      key={label.label_id}
                      idPrefix={idPrefix}
                      label={label}
                      onRemove={() => handleRemove(label.label_id)}
                      onCatalogNumberChange={(catalogNumber) => {
                        const newLabels = labels.map((l) =>
                          l.label_id === label.label_id ? { ...l, catalog_number: catalogNumber || null } : l,
                        );
                        persistLabels(newLabels);
                      }}
                    />
                  ))}
                </Table.Tbody>
              </Table>
            </SortableContext>
          </DndContext>
        )}
      </Stack>

      <Modal opened={addModalOpened} onClose={closeAddModal} title={t('modal.title')}>
        <Stack>
          <Select
            id={idPrefix ? `${idPrefix}-select` : undefined}
            label={tCommon('entities.label')}
            placeholder={t('placeholders.selectLabel')}
            data={
              availableLabels?.map((l) => ({
                value: l.id,
                label: l.name,
              })) || []
            }
            value={selectedLabelId}
            onChange={setSelectedLabelId}
            searchable
          />
          <TextInput
            id={idPrefix ? `${idPrefix}-catalog-number` : undefined}
            label={tCommon('labels.catalogNumber')}
            placeholder={t('placeholders.catalogNumber')}
            value={catalogNumber}
            onChange={(e) => setCatalogNumber(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button emphasis="low" onClick={closeAddModal}>
              {tCommon('actions.cancel')}
            </Button>
            <Button onClick={handleAdd} disabled={!selectedLabelId}>
              {tCommon('actions.add')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </SectionCard>
  );
}

// Sortable label row component
interface SortableLabelRowProps {
  idPrefix?: string;
  label: ReleaseLabelItem;
  onRemove: () => void;
  onCatalogNumberChange: (catalogNumber: string) => void;
}

function SortableLabelRow({ idPrefix, label, onRemove, onCatalogNumberChange }: SortableLabelRowProps) {
  const tCommon = useTranslations('common');
  const t = useTranslations('releaseEditor.labels');
  const [modalOpened, setModalOpened] = useState(false);
  const [localCatalogNumber, setLocalCatalogNumber] = useState(label.catalog_number || '');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: label.label_id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleOpen = () => {
    setLocalCatalogNumber(label.catalog_number || '');
    setModalOpened(true);
  };

  const handleSave = () => {
    onCatalogNumberChange(localCatalogNumber);
    setModalOpened(false);
  };

  return (
    <>
      <Table.Tr ref={setNodeRef} style={style}>
        <Table.Td>
          <Box {...attributes} {...listeners} style={{ cursor: 'grab' }}>
            <IconGripVertical size={14} color="gray" />
          </Box>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{label.label_name}</Text>
        </Table.Td>
        <Table.Td>
          <Group gap={4}>
            <Text size="sm" c={label.catalog_number ? undefined : 'dimmed'}>
              {label.catalog_number || '-'}
            </Text>
            <IconButton
              tone="neutral"
              emphasis="low"
              size="xs"
              aria-label={tCommon('actions.edit')}
              onClick={handleOpen}
            >
              <IconPencil size={12} />
            </IconButton>
          </Group>
        </Table.Td>
        <Table.Td>
          <IconButton tone="danger" emphasis="low" size="sm" aria-label={tCommon('actions.remove')} onClick={onRemove}>
            <IconX size={14} />
          </IconButton>
        </Table.Td>
      </Table.Tr>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={`${tCommon('actions.edit')} ${tCommon('labels.catalogNumber')} - ${label.label_name}`}
        size="sm"
        centered
      >
        <Stack>
          <TextInput
            id={idPrefix ? `${idPrefix}-catalog-number-${label.label_id}` : undefined}
            label={tCommon('labels.catalogNumber')}
            placeholder={t('placeholders.catalogNumber')}
            value={localCatalogNumber}
            onChange={(e) => setLocalCatalogNumber(e.currentTarget.value)}
            autoFocus
          />
          <Group justify="flex-end">
            <Button emphasis="low" onClick={() => setModalOpened(false)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button onClick={handleSave}>{tCommon('actions.save')}</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
