'use client';
import { SupportingText, Text as DsText } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
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
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortableItem } from '@/components/core/Sortable';
import { IconGripVertical, IconPencil, IconPlus, IconX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Table } from '@/components/core/Display';
import { ContentModal, DialogActions } from '@/components/core/Modal';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
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
  const tModalActions = useTranslations('common.actions');
  const tCommon = useTranslations('common');
  const t = useTranslations('releaseEditor.labels');
  const [addModalOpened, { open: openAddModal, close: closeAddModal }] = useDisclosure(false);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [catalogNumber, setCatalogNumber] = useState('');
  const allLabelsQuery = useQuery({
    queryKey: ['label', 'list'],
    queryFn: () => listLabelsForSelector(),
  });
  const { data: allLabels } = allLabelsQuery;
  const setLabels = useMutation({
    mutationFn: ({
      nextLabels,
      orderIntent,
    }: {
      nextLabels: {
        labelId: string;
        catalogNumber?: string;
        sortOrder: number;
      }[];
      orderIntent?: {
        itemId: string;
        previousItemId?: string;
        nextItemId?: string;
      };
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
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      publishEditorEntityChange(`release:${releaseId}`);
      notifications.show({
        message: tCommon('messages.itemUpdated', { item: tCommon('entities.labels') }),
        tone: 'positive',
      });
    },
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const persistLabels = (
    nextLabels: ReleaseLabelItem[],
    orderIntent?: {
      itemId: string;
      previousItemId?: string;
      nextItemId?: string;
    },
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
      <QueryErrorAlert queries={[allLabelsQuery]} />
      <DsLayoutStack>
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
          <SupportingText tone="secondary">{t('empty')}</SupportingText>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={labels.map((l) => l.label_id)} strategy={verticalListSortingStrategy}>
              <Table density="compact">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th />
                    <Table.Th>{tCommon('entities.label')}</Table.Th>
                    <Table.Th>{tCommon('labels.catalogNumber')}</Table.Th>
                    <Table.Th />
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
      </DsLayoutStack>

      <ContentModal
        opened={addModalOpened}
        onClose={closeAddModal}
        title={t('modal.title')}
        closeLabel={tModalActions('close')}
      >
        <DsLayoutStack>
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
          <DialogActions>
            <Button emphasis="low" onClick={closeAddModal}>
              {tCommon('actions.cancel')}
            </Button>
            <Button tone="neutral" emphasis="strong" onClick={handleAdd} disabled={!selectedLabelId}>
              {tCommon('actions.add')}
            </Button>
          </DialogActions>
        </DsLayoutStack>
      </ContentModal>
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
export function SortableLabelRow({ idPrefix, label, onRemove, onCatalogNumberChange }: SortableLabelRowProps) {
  const tModalActions = useTranslations('common.actions');
  const tCommon = useTranslations('common');
  const tSort = useTranslations('dataTable.sort');
  const t = useTranslations('releaseEditor.labels');
  const [modalOpened, setModalOpened] = useState(false);
  const [localCatalogNumber, setLocalCatalogNumber] = useState(label.catalog_number || '');
  const labelNameId = useId();
  const sortable = useSortableItem({
    id: label.label_id,
  });
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
      <Table.Tr ref={sortable.setNodeRef} dragState={sortable.dragState}>
        <Table.Td>
          <IconButton
            emphasis="low"
            interaction="drag-handle"
            draggable={false}
            {...sortable.handle}
            aria-label={tSort('aria.reorder', { label: label.label_name })}
          >
            <IconGripVertical aria-hidden />
          </IconButton>
        </Table.Td>
        <Table.Td>
          <DsText id={labelNameId} size="sm">
            {label.label_name}
          </DsText>
        </Table.Td>
        <Table.Td>
          <DsLayoutInline gap="xxs" wrap="nowrap">
            <DsText size="sm" tone={label.catalog_number ? undefined : 'secondary'}>
              {label.catalog_number || '-'}
            </DsText>
            <IconButton
              tone="neutral"
              emphasis="low"
              size="compact"
              aria-label={tCommon('actions.edit')}
              aria-describedby={labelNameId}
              onClick={handleOpen}
            >
              <IconPencil size={12} />
            </IconButton>
          </DsLayoutInline>
        </Table.Td>
        <Table.Td>
          <IconButton
            tone="danger"
            emphasis="low"
            size="compact"
            aria-label={tCommon('actions.remove')}
            aria-describedby={labelNameId}
            onClick={onRemove}
          >
            <IconX size={14} />
          </IconButton>
        </Table.Td>
      </Table.Tr>

      <ContentModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={`${tCommon('actions.edit')} ${tCommon('labels.catalogNumber')} - ${label.label_name}`}
        size="compact"
        centered
        closeLabel={tModalActions('close')}
      >
        <DsLayoutStack>
          <TextInput
            id={idPrefix ? `${idPrefix}-catalog-number-${label.label_id}` : undefined}
            label={tCommon('labels.catalogNumber')}
            placeholder={t('placeholders.catalogNumber')}
            value={localCatalogNumber}
            onChange={(e) => setLocalCatalogNumber(e.currentTarget.value)}
            autoFocus
          />
          <DialogActions>
            <Button emphasis="low" onClick={() => setModalOpened(false)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button emphasis="strong" onClick={handleSave}>
              {tCommon('actions.save')}
            </Button>
          </DialogActions>
        </DsLayoutStack>
      </ContentModal>
    </>
  );
}
