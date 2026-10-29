'use client';
import { useReleaseEditorCanEdit } from './ReleaseEditorAccessContext';
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
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortableItem } from '@/components/core/Sortable';
import { IconGripVertical, IconPencil, IconPlus, IconX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Table } from '@/components/core/Display';
import { ContentModal, DialogActions } from '@/components/core/Modal';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { Button, SaveButton } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { Select, TextInput } from '@/components/core/Input';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { setReleaseLabelsAction } from '@/lib/actions/release';
import { publishEditorEntityChange } from '@/lib/editor/editor-entity-changes';
import { listLabelsForSelector } from '@/lib/queries/label-browser';
import type { ReleaseLabelItem } from '@/lib/types/release/model';
import { reorderWithIntent } from './reorder-with-intent';
interface ReleaseLabelsSectionProps {
  releaseId: string;
  idPrefix?: string;
  labels: ReleaseLabelItem[];
  onLabelsChange: (labels: ReleaseLabelItem[]) => void;
  onMutationStart?: () => string | void;
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
  const canEdit = useReleaseEditorCanEdit();
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
    mutationFn: async ({
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
    }) => {
      const editorOrigin = onMutationStart?.() ?? undefined;
      return {
        ...(await setReleaseLabelsAction(
          releaseId,
          nextLabels,
          labels.map((label, sortOrder) => ({
            labelId: label.label_id,
            catalogNumber: label.catalog_number || undefined,
            sortOrder,
          })),
          orderIntent,
          editorOrigin,
        )),
        editorOrigin,
      };
    },
    onSettled: (result, error) => onMutationSettled?.(!error && !result?.error),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      publishEditorEntityChange(`release:${releaseId}`, result.editorOrigin);
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
    if (!canEdit) {
      return;
    }
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
    if (!canEdit) {
      return;
    }
    const reorder = reorderWithIntent(labels, event.active.id, event.over?.id, (label) => label.label_id);
    if (reorder) {
      persistLabels(reorder.items, reorder.intent);
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
              disabled={!canEdit}
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
            disabled={!canEdit}
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
            disabled={!canEdit}
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
            <Button tone="neutral" emphasis="strong" onClick={handleAdd} disabled={!canEdit || !selectedLabelId}>
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
  const canEdit = useReleaseEditorCanEdit();
  const tCommon = useTranslations('common');
  const tSort = useTranslations('dataTable.sort');
  const t = useTranslations('releaseEditor.labels');
  const [modalOpened, setModalOpened] = useState(false);
  const [localCatalogNumber, setLocalCatalogNumber] = useState(label.catalog_number || '');
  const labelNameId = useId();
  const sortable = useSortableItem({
    id: label.label_id,
    disabled: !canEdit,
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
            disabled={!canEdit}
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
              disabled={!canEdit}
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
            disabled={!canEdit}
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
            disabled={!canEdit}
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
            <SaveButton type="button" disabled={!canEdit} onClick={handleSave}>
              {tCommon('actions.save')}
            </SaveButton>
          </DialogActions>
        </DsLayoutStack>
      </ContentModal>
    </>
  );
}
