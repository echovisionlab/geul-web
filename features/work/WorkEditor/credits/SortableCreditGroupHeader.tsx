'use client';

import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';

import { Text as DsText } from '@/components/core/Typography';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableSurface, ReorderRow, useSortableItem } from '@/components/core/Sortable';
import { IconCheck, IconEdit, IconGripVertical, IconTrash, IconX } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { SectionCard } from '@/components/core/Section';
import { IconButton } from '@/components/core/IconButton';
import { TextInput } from '@/components/core/Input';
import type { WorkCreditGroup } from '@/lib/types/work/credit';

interface SortableCreditGroupHeaderProps {
  group: WorkCreditGroup;
  canEdit: boolean;
  onEdit: (groupId: string, name: string) => void;
  onDelete: (groupId: string) => void;
  isDeleting: boolean;
}

export function SortableCreditGroupHeader({
  group,
  canEdit,
  onEdit,
  onDelete,
  isDeleting,
}: SortableCreditGroupHeaderProps) {
  const t = useTranslations('workCredits');
  const tCommon = useTranslations('common.actions');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const groupNameId = useId();
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (wasEditing.current && !isEditing) {
      editButtonRef.current?.focus();
    }
    wasEditing.current = isEditing;
  }, [isEditing]);

  const sortable = useSortableItem({
    id: `group-${group.id}`,
    data: { type: 'group', groupId: group.id },
    disabled: !canEdit,
  });

  // Make this group a drop target for credits (same ID as sortable)
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `group-${group.id}`,
    data: { type: 'group', groupId: group.id },
  });

  // Combine refs from sortable and droppable
  const { setNodeRef: setSortableRef } = sortable;
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      setSortableRef(node);
      setDroppableRef(node);
    },
    [setSortableRef, setDroppableRef],
  );

  const handleSaveEdit = () => {
    if (!canEdit) {
      return;
    }
    if (editName.trim() && editName !== group.name) {
      onEdit(group.id, editName.trim());
    }
    setIsEditing(false);
  };

  return (
    <SortableSurface ref={setNodeRef} motion={sortable.motion}>
      <SectionCard padding="none" appearance="plain" state={isOver ? 'drop-target' : 'default'}>
        <ReorderRow
          handle={
            canEdit ? (
              <IconButton
                interaction="drag-handle"
                draggable={false}
                {...sortable.handle}
                aria-label={t('actions.reorderGroup')}
                aria-describedby={isEditing ? undefined : groupNameId}
              >
                <IconGripVertical aria-hidden />
              </IconButton>
            ) : undefined
          }
          actions={
            canEdit && !isEditing ? (
              <DsLayoutInline gap="none" wrap="nowrap">
                <IconButton
                  ref={editButtonRef}
                  onClick={() => {
                    setEditName(group.name);
                    setIsEditing(true);
                  }}
                  aria-label={t('actions.editGroup')}
                  aria-describedby={groupNameId}
                >
                  <IconEdit aria-hidden />
                </IconButton>
                <IconButton
                  tone="danger"
                  onClick={() => onDelete(group.id)}
                  loading={isDeleting}
                  aria-label={t('actions.deleteGroup')}
                  aria-describedby={groupNameId}
                >
                  <IconTrash aria-hidden />
                </IconButton>
              </DsLayoutInline>
            ) : undefined
          }
        >
          {isEditing ? (
            <DsLayoutInline gap="none" wrap="nowrap">
              <TextInput
                readOnly={!canEdit}
                size="xs"
                aria-label={t('fields.groupPlaceholder')}
                value={editName}
                onChange={(e) => setEditName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) {
                    return;
                  }
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      handleSaveEdit();
                    } else {
                      setEditName(group.name);
                      setIsEditing(false);
                    }
                  }
                }}
                autoFocus
              />
              <IconButton tone="positive" disabled={!canEdit} onClick={handleSaveEdit} aria-label={tCommon('save')}>
                <IconCheck aria-hidden />
              </IconButton>
              <IconButton
                onClick={() => {
                  setEditName(group.name);
                  setIsEditing(false);
                }}
                aria-label={tCommon('cancel')}
              >
                <IconX aria-hidden />
              </IconButton>
            </DsLayoutInline>
          ) : (
            <DsText id={groupNameId} size="xs" weight="strong" tone="secondary">
              {group.name}
            </DsText>
          )}
        </ReorderRow>
      </SectionCard>
    </SortableSurface>
  );
}
