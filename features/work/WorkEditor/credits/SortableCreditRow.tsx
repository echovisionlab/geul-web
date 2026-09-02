'use client';

import { useState } from 'react';
import NextImage from 'next/image';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconCheck, IconEdit, IconGripVertical, IconX } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box, Group, Text } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import { IconButton } from '@/components/core/IconButton';
import { TextInput } from '@/components/core/Input';
import type { WorkCreditWithDetails } from '@/lib/types/work/credit';
import { isManagedCdnAssetUrl } from '@/lib/utils/file-url';

interface SortableCreditRowProps {
  credit: WorkCreditWithDetails;
  groupId: string | null;
  canEdit: boolean;
  onRemove: (creditId: string) => void;
  onEditRole: (creditId: string, creditRole: string | null) => void;
  isRemoving: boolean;
  isUpdating: boolean;
}

export function SortableCreditRow({
  credit,
  groupId,
  canEdit,
  onRemove,
  onEditRole,
  isRemoving,
  isUpdating,
}: SortableCreditRowProps) {
  const t = useTranslations('workCredits');
  const tCommon = useTranslations('common');
  const tCommonStates = useTranslations('common.states');
  const [isEditing, setIsEditing] = useState(false);
  const [editRole, setEditRole] = useState(credit.creditRole ?? '');

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `credit-${credit.id}`,
    data: { type: 'credit', creditId: credit.id, groupId },
    disabled: !canEdit,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginLeft: groupId ? 24 : 0, // Indent if in a group
  };

  const displayName = credit.artist?.name || credit.member?.name || credit.name || tCommonStates('unknown');
  const displayImage = credit.artist?.imageUrl || credit.member?.image || null;
  const creditType: 'artist' | 'member' | 'name' = credit.artist ? 'artist' : credit.member ? 'member' : 'name';

  const handleSaveRole = () => {
    const newRole = editRole.trim() || null;
    if (newRole !== credit.creditRole) {
      onEditRole(credit.id, newRole);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditRole(credit.creditRole ?? '');
    setIsEditing(false);
  };

  return (
    <Group ref={setNodeRef} style={style} gap="xs" justify="space-between" py={4}>
      <Group gap="xs">
        {canEdit && (
          <IconButton
            emphasis="low"
            size="xs"
            style={{ cursor: 'grab' }}
            {...attributes}
            {...listeners}
            aria-label={t('actions.reorderCredit')}
          >
            <IconGripVertical size={14} />
          </IconButton>
        )}
        {displayImage ? (
          <Box
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              overflow: 'hidden',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <NextImage
              src={displayImage}
              alt={displayName}
              fill
              sizes="26px"
              style={{ objectFit: 'cover' }}
              unoptimized={displayImage.startsWith('http') && !isManagedCdnAssetUrl(displayImage)}
            />
          </Box>
        ) : (
          <Box
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              backgroundColor: 'var(--mantine-color-blue-filled)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 11,
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            {displayName.charAt(0)}
          </Box>
        )}
        <Text size="xs">{displayName}</Text>
        {creditType !== 'name' && (
          <LabelBadge size="xs" tone="accent">
            {creditType === 'artist' ? tCommon('entities.artist') : tCommon('entities.member')}
          </LabelBadge>
        )}
        {isEditing ? (
          <Group gap={4}>
            <TextInput
              size="xs"
              value={editRole}
              onChange={(e) => setEditRole(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveRole();
                }
                if (e.key === 'Escape') {
                  handleCancelEdit();
                }
              }}
              placeholder={t('fields.rolePlaceholder')}
              autoFocus
              styles={{ input: { height: 24, minHeight: 24, width: 100 } }}
            />
            <IconButton
              tone="positive"
              emphasis="low"
              size="xs"
              onClick={handleSaveRole}
              loading={isUpdating}
              aria-label={t('actions.saveEdit')}
            >
              <IconCheck size={12} />
            </IconButton>
            <IconButton
              tone="neutral"
              emphasis="low"
              size="xs"
              onClick={handleCancelEdit}
              aria-label={t('actions.cancelEdit')}
            >
              <IconX size={12} />
            </IconButton>
          </Group>
        ) : (
          credit.creditRole && (
            <Text size="xs" c="dimmed">
              — {credit.creditRole}
            </Text>
          )
        )}
      </Group>
      {canEdit && !isEditing && (
        <Group gap={2}>
          <IconButton
            tone="neutral"
            emphasis="low"
            size="xs"
            onClick={() => setIsEditing(true)}
            aria-label={t('actions.editRole')}
          >
            <IconEdit size={12} />
          </IconButton>
          <IconButton
            tone="danger"
            emphasis="low"
            size="xs"
            onClick={() => onRemove(credit.id)}
            loading={isRemoving}
            aria-label={t('actions.removeCredit')}
          >
            <IconX size={12} />
          </IconButton>
        </Group>
      )}
    </Group>
  );
}
