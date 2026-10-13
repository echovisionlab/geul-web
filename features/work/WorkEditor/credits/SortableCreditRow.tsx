'use client';
import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useEffect, useId, useRef, useState } from 'react';
import { Avatar } from '@/components/core/Display';
import { SortableSurface, ReorderRow, useSortableItem } from '@/components/core/Sortable';
import { IconCheck, IconEdit, IconGripVertical, IconX } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { LabelBadge } from '@/components/core/Badge';
import { IconButton } from '@/components/core/IconButton';
import { TextInput } from '@/components/core/Input';
import type { WorkCreditWithDetails } from '@/lib/types/work/credit';
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
  const creditNameId = useId();
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (wasEditing.current && !isEditing) {
      editButtonRef.current?.focus();
    }
    wasEditing.current = isEditing;
  }, [isEditing]);
  const sortable = useSortableItem({
    id: `credit-${credit.id}`,
    data: { type: 'credit', creditId: credit.id, groupId },
    disabled: !canEdit,
  });

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
    <SortableSurface ref={sortable.setNodeRef} motion={sortable.motion}>
      <ReorderRow
        indent={groupId ? 'parent-label' : 'none'}
        handle={
          canEdit ? (
            <IconButton
              interaction="drag-handle"
              draggable={false}
              {...sortable.handle}
              aria-label={t('actions.reorderCredit')}
              aria-describedby={creditNameId}
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
                  setEditRole(credit.creditRole ?? '');
                  setIsEditing(true);
                }}
                aria-label={t('actions.editRole')}
                aria-describedby={creditNameId}
              >
                <IconEdit aria-hidden />
              </IconButton>
              <IconButton
                tone="danger"
                onClick={() => onRemove(credit.id)}
                loading={isRemoving}
                aria-label={t('actions.removeCredit')}
                aria-describedby={creditNameId}
              >
                <IconX aria-hidden />
              </IconButton>
            </DsLayoutInline>
          ) : undefined
        }
      >
        <DsLayoutInline gap="xxs">
          <Avatar src={displayImage} alt={displayName} size="xs" shape="circle" name={displayName} />
          <DsText id={creditNameId} size="xs">
            {displayName}
          </DsText>
          {creditType !== 'name' ? (
            <LabelBadge tone="accent">
              {creditType === 'artist' ? tCommon('entities.artist') : tCommon('entities.member')}
            </LabelBadge>
          ) : null}
          {isEditing ? (
            <DsLayoutInline gap="none" wrap="nowrap">
              <TextInput
                size="xs"
                aria-label={tCommon('labels.role')}
                aria-describedby={creditNameId}
                value={editRole}
                onChange={(e) => setEditRole(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) {
                    return;
                  }
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      handleSaveRole();
                    } else {
                      handleCancelEdit();
                    }
                  }
                }}
                placeholder={t('fields.rolePlaceholder')}
                autoFocus
              />
              <IconButton
                tone="positive"
                onClick={handleSaveRole}
                loading={isUpdating}
                aria-label={t('actions.saveEdit')}
                aria-describedby={creditNameId}
              >
                <IconCheck aria-hidden />
              </IconButton>
              <IconButton
                onClick={handleCancelEdit}
                aria-label={t('actions.cancelEdit')}
                aria-describedby={creditNameId}
              >
                <IconX aria-hidden />
              </IconButton>
            </DsLayoutInline>
          ) : credit.creditRole ? (
            <DsText size="xs" tone="secondary">
              — {credit.creditRole}
            </DsText>
          ) : null}
        </DsLayoutInline>
      </ReorderRow>
    </SortableSurface>
  );
}
