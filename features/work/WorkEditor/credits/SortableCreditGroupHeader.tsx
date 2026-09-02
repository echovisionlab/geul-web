'use client';

import { useCallback, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconCheck, IconEdit, IconGripVertical, IconTrash, IconX } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Group, Text } from '@mantine/core';
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

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
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
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      setSortableRef(node);
      setDroppableRef(node);
    },
    [setSortableRef, setDroppableRef],
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isOver ? 'var(--mantine-color-blue-light)' : undefined,
    borderRadius: isOver ? 'var(--mantine-radius-sm)' : undefined,
  };

  const handleSaveEdit = () => {
    if (editName.trim() && editName !== group.name) {
      onEdit(group.id, editName.trim());
    }
    setIsEditing(false);
  };

  return (
    <Group ref={setNodeRef} style={style} gap="xs" py={6} justify="space-between">
      <Group gap="xs">
        {canEdit && (
          <IconButton
            emphasis="low"
            size="xs"
            style={{ cursor: 'grab' }}
            {...attributes}
            {...listeners}
            aria-label={t('actions.reorderGroup')}
          >
            <IconGripVertical size={14} />
          </IconButton>
        )}
        {isEditing ? (
          <Group gap={4}>
            <TextInput
              size="xs"
              value={editName}
              onChange={(e) => setEditName(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
              autoFocus
              styles={{ input: { height: 24, minHeight: 24 } }}
            />
            <IconButton tone="positive" emphasis="low" size="xs" onClick={handleSaveEdit} aria-label={tCommon('save')}>
              <IconCheck size={12} />
            </IconButton>
            <IconButton
              tone="neutral"
              emphasis="low"
              size="xs"
              onClick={() => {
                setEditName(group.name);
                setIsEditing(false);
              }}
              aria-label={tCommon('cancel')}
            >
              <IconX size={12} />
            </IconButton>
          </Group>
        ) : (
          <Text size="xs" fw={600} c="dimmed">
            {group.name}
          </Text>
        )}
      </Group>
      {canEdit && !isEditing && (
        <Group gap={2}>
          <IconButton
            tone="neutral"
            emphasis="low"
            size="xs"
            onClick={() => setIsEditing(true)}
            aria-label={t('actions.editGroup')}
          >
            <IconEdit size={12} />
          </IconButton>
          <IconButton
            tone="danger"
            emphasis="low"
            size="xs"
            onClick={() => onDelete(group.id)}
            loading={isDeleting}
            aria-label={t('actions.deleteGroup')}
          >
            <IconTrash size={12} />
          </IconButton>
        </Group>
      )}
    </Group>
  );
}
