'use client';
import { SupportingText, Text as DsText } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';
import { useEffect, useId, useState } from 'react';
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
import { Select, Textarea, TextInput, SegmentedControl } from '@/components/core/Input';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { listArtistsAction } from '@/lib/actions/artist';
import { setReleaseCreditsAction } from '@/lib/actions/release';
import { publishEditorEntityChange } from '@/lib/editor/editor-entity-changes';
import { listUsersAdminAction } from '@/lib/actions/user';
import type { CreditTargetType, ReleaseCreditItem } from '@/lib/types/release/model';
interface ReleaseCreditsSectionProps {
  releaseId: string;
  idPrefix?: string;
  credits: ReleaseCreditItem[];
  creditNotes: Record<string, string>;
  canEdit: boolean;
  canEditNotes: boolean;
  onCreditsChange: (credits: ReleaseCreditItem[]) => void;
  onCreditNoteChange: (creditId: string, note: string) => void;
  onMutationStart?: () => void;
  onMutationSettled?: (succeeded: boolean) => void;
}
export function ReleaseCreditsSection({
  releaseId,
  idPrefix,
  credits,
  creditNotes,
  canEdit,
  canEditNotes,
  onCreditsChange,
  onCreditNoteChange,
  onMutationStart,
  onMutationSettled,
}: ReleaseCreditsSectionProps) {
  const tModalActions = useTranslations('common.actions');
  const tCommon = useTranslations('common');
  const t = useTranslations('releaseEditor.credits');
  const [addModalOpened, { open: openAddModal, close: closeAddModal }] = useDisclosure(false);
  const [creditType, setCreditType] = useState<CreditTargetType>('artist');
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedUserId] = useState<string | null>(null);
  const [creditedName, setCreditedName] = useState('');
  const [creditRole, setCreditRole] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const allArtistsQuery = useQuery({
    queryKey: ['artist', 'list'],
    queryFn: () => listArtistsAction().then(unwrapQueryResult),
  });
  const { data: allArtists } = allArtistsQuery;
  const allMembersQuery = useQuery({
    queryKey: ['member', 'listAdmin'],
    queryFn: () => listUsersAdminAction({}).then(unwrapQueryResult),
  });
  const { data: allMembers } = allMembersQuery;
  const setCredits = useMutation({
    mutationFn: (mutation: {
      credits: {
        id?: string;
        artistId?: string | null;
        memberId?: string | null;
        creditedName?: string | null;
        creditRole?: string | null;
        sortOrder: number;
      }[];
      orderIntent?: {
        itemId: string;
        previousItemId?: string;
        nextItemId?: string;
      };
    }) =>
      setReleaseCreditsAction(
        releaseId,
        mutation.credits,
        credits.map((credit, sortOrder) => ({
          id: credit.id,
          artistId: credit.artist_id,
          memberId: credit.member_id,
          creditedName: credit.credited_name,
          creditRole: credit.credit_role,
          sortOrder,
        })),
        mutation.orderIntent,
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
        message: tCommon('messages.itemUpdated', { item: tCommon('entities.credits') }),
        tone: 'positive',
      });
    },
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const persistCredits = (
    nextCredits: ReleaseCreditItem[],
    orderIntent?: {
      itemId: string;
      previousItemId?: string;
      nextItemId?: string;
    },
  ) => {
    if (!canEdit) {
      return;
    }
    const normalizedCredits = nextCredits.map((credit, index) => ({
      ...credit,
      sort_order: index,
    }));
    onCreditsChange(normalizedCredits);
    setCredits.mutate({
      credits: normalizedCredits.map((credit, index) => ({
        id: credit.id,
        artistId: credit.artist_id,
        memberId: credit.member_id,
        creditedName: credit.credited_name,
        creditRole: credit.credit_role,
        sortOrder: index,
      })),
      orderIntent,
    });
  };
  const handleDragEnd = (event: DragEndEvent) => {
    if (!canEdit) {
      return;
    }
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = credits.findIndex((c) => c.id === active.id);
    const newIndex = credits.findIndex((c) => c.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(credits, oldIndex, newIndex);
      const movedIndex = reordered.findIndex((credit) => credit.id === active.id);
      persistCredits(reordered, {
        itemId: String(active.id),
        previousItemId: movedIndex > 0 ? reordered[movedIndex - 1].id : undefined,
        nextItemId: movedIndex + 1 < reordered.length ? reordered[movedIndex + 1].id : undefined,
      });
    }
  };
  const handleAdd = () => {
    if (!canEdit) {
      return;
    }
    // Validate based on credit type
    if (creditType === 'artist' && !selectedArtistId) {
      return;
    }
    if (creditType === 'member' && !selectedMemberId) {
      return;
    }
    if (creditType === 'text' && !creditedName.trim()) {
      return;
    }
    // Build new credit based on type
    let newCredit: ReleaseCreditItem;
    if (creditType === 'artist') {
      const artist = allArtists?.find((a) => a.id === selectedArtistId);
      if (!artist) {
        return;
      }
      // Check for duplicates
      const isDuplicate = credits.some((c) => c.artist_id === selectedArtistId && c.credit_role === creditRole);
      if (isDuplicate) {
        notifications.show({ message: t('duplicate'), tone: 'warning' });
        return;
      }
      newCredit = {
        id: crypto.randomUUID(),
        credit_type: 'artist',
        artist_id: artist.id,
        artist_name: artist.name,
        artist_slug: artist.slug,
        member_id: null,
        member_name: null,
        credited_name: null,
        credit_role: creditRole || null,
        sort_order: credits.length,
      };
    } else if (creditType === 'member') {
      const member = allMembers?.data?.find((u) => u.id === selectedMemberId);
      if (!member) {
        return;
      }
      // Check for duplicates
      const isDuplicate = credits.some((c) => c.member_id === selectedMemberId && c.credit_role === creditRole);
      if (isDuplicate) {
        notifications.show({ message: t('duplicate'), tone: 'warning' });
        return;
      }
      newCredit = {
        id: crypto.randomUUID(),
        credit_type: 'member',
        artist_id: null,
        artist_name: null,
        artist_slug: null,
        member_id: member.id,
        member_name: member.nickname,
        credited_name: null,
        credit_role: creditRole || null,
        sort_order: credits.length,
      };
    } else {
      // Text credit
      newCredit = {
        id: crypto.randomUUID(),
        credit_type: 'text',
        artist_id: null,
        artist_name: null,
        artist_slug: null,
        member_id: null,
        member_name: null,
        credited_name: creditedName.trim(),
        credit_role: creditRole || null,
        sort_order: credits.length,
      };
    }
    const newCredits = [...credits, newCredit];
    persistCredits(newCredits);
    if (canEditNotes && creditNote.trim()) {
      onCreditNoteChange(newCredit.id, creditNote.trim());
    }
    resetModalState();
  };
  const resetModalState = () => {
    closeAddModal();
    setCreditType('artist');
    setSelectedArtistId(null);
    setSelectedUserId(null);
    setCreditedName('');
    setCreditRole('');
    setCreditNote('');
  };
  const handleRemove = (creditId: string) => {
    if (!canEdit) {
      return;
    }
    persistCredits(credits.filter((credit) => credit.id !== creditId));
    onCreditNoteChange(creditId, '');
  };
  // Helper to get display name based on credit type
  const getCreditDisplayName = (credit: ReleaseCreditItem): string => {
    if (credit.credit_type === 'artist' && credit.artist_name) {
      return credit.artist_name;
    }
    if (credit.credit_type === 'member' && credit.member_name) {
      return credit.member_name;
    }
    if (credit.credit_type === 'text' && credit.credited_name) {
      return credit.credited_name;
    }
    return tCommon('states.unknown');
  };
  return (
    <SectionCard>
      <QueryErrorAlert queries={[allArtistsQuery, allMembersQuery]} />
      <DsLayoutStack>
        <SectionHeader
          title={tCommon('entities.credits')}
          actions={
            <Button
              id={idPrefix ? `${idPrefix}-add-button` : undefined}
              emphasis="medium"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={openAddModal}
              disabled={!canEdit}
            >
              {tCommon('actions.addItem', { item: tCommon('entities.credit') })}
            </Button>
          }
        />

        {credits.length === 0 ? (
          <SupportingText tone="secondary">{t('empty')}</SupportingText>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={credits.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <Table density="compact">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th />
                    <Table.Th>{tCommon('labels.name')}</Table.Th>
                    <Table.Th>{tCommon('labels.role')}</Table.Th>
                    <Table.Th>{t('fields.noteOptional')}</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {credits.map((credit) => (
                    <SortableCreditRow
                      key={credit.id}
                      idPrefix={idPrefix}
                      credit={credit}
                      note={creditNotes[credit.id] ?? ''}
                      canEdit={canEdit}
                      canEditNote={canEditNotes}
                      onRemove={() => handleRemove(credit.id)}
                      onNoteChange={(note) => onCreditNoteChange(credit.id, note)}
                      getCreditDisplayName={getCreditDisplayName}
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
        onClose={resetModalState}
        title={tCommon('actions.addItem', { item: tCommon('entities.credit') })}
        closeLabel={tModalActions('close')}
      >
        <DsLayoutStack>
          <SegmentedControl
            id={idPrefix ? `${idPrefix}-type` : undefined}
            value={creditType}
            onChange={(v) => setCreditType(v as CreditTargetType)}
            data={[
              { value: 'artist', label: tCommon('entities.artist') },
              { value: 'member', label: tCommon('entities.member') },
              { value: 'text', label: tCommon('labels.text') },
            ]}
            fullWidth
            disabled={!canEdit}
          />

          {creditType === 'artist' && (
            <Select
              id={idPrefix ? `${idPrefix}-artist-id` : undefined}
              label={tCommon('entities.artist')}
              placeholder={t('placeholders.selectArtist')}
              data={
                allArtists?.map((a) => ({
                  value: a.id,
                  label: a.name,
                })) || []
              }
              value={selectedArtistId}
              onChange={setSelectedArtistId}
              searchable
              disabled={!canEdit}
            />
          )}

          {creditType === 'member' && (
            <Select
              id={idPrefix ? `${idPrefix}-member-id` : undefined}
              label={tCommon('entities.member')}
              placeholder={t('placeholders.selectUser')}
              data={
                allMembers?.data?.map((u) => ({
                  value: u.id,
                  label: u.nickname,
                })) || []
              }
              value={selectedMemberId}
              onChange={setSelectedUserId}
              searchable
              disabled={!canEdit}
            />
          )}

          {creditType === 'text' && (
            <TextInput
              id={idPrefix ? `${idPrefix}-credited-name` : undefined}
              label={tCommon('labels.creditedName')}
              placeholder={t('placeholders.creditedName')}
              value={creditedName}
              onChange={(e) => setCreditedName(e.currentTarget.value)}
              disabled={!canEdit}
            />
          )}

          <TextInput
            id={idPrefix ? `${idPrefix}-role` : undefined}
            label={t('fields.roleOptional')}
            placeholder={t('placeholders.role')}
            value={creditRole}
            onChange={(e) => setCreditRole(e.currentTarget.value)}
            disabled={!canEdit}
          />
          <Textarea
            id={idPrefix ? `${idPrefix}-note` : undefined}
            label={t('fields.noteOptional')}
            placeholder={t('placeholders.note')}
            value={creditNote}
            onChange={(e) => setCreditNote(e.currentTarget.value)}
            autosize
            minRows={2}
            disabled={!canEdit || !canEditNotes}
          />
          <DialogActions>
            <Button emphasis="low" onClick={resetModalState}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              tone="neutral"
              emphasis="strong"
              onClick={handleAdd}
              disabled={
                !canEdit ||
                (creditType === 'artist' && !selectedArtistId) ||
                (creditType === 'member' && !selectedMemberId) ||
                (creditType === 'text' && !creditedName.trim())
              }
            >
              {tCommon('actions.add')}
            </Button>
          </DialogActions>
        </DsLayoutStack>
      </ContentModal>
    </SectionCard>
  );
}
// Sortable credit row component
interface SortableCreditRowProps {
  idPrefix?: string;
  credit: ReleaseCreditItem;
  note: string;
  canEdit: boolean;
  canEditNote: boolean;
  onRemove: () => void;
  onNoteChange: (note: string) => void;
  getCreditDisplayName: (credit: ReleaseCreditItem) => string;
}
export function SortableCreditRow({
  idPrefix,
  credit,
  note,
  canEdit,
  canEditNote,
  onRemove,
  onNoteChange,
  getCreditDisplayName,
}: SortableCreditRowProps) {
  const tModalActions = useTranslations('common.actions');
  const tCommon = useTranslations('common');
  const tSort = useTranslations('dataTable.sort');
  const t = useTranslations('releaseEditor.credits');
  const [noteModalOpened, setNoteModalOpened] = useState(false);
  const [localNote, setLocalNote] = useState(note);
  const creditNameId = useId();
  const sortable = useSortableItem({
    id: credit.id,
    disabled: !canEdit,
  });
  useEffect(() => {
    setLocalNote(note);
  }, [note]);
  return (
    <>
      <Table.Tr ref={sortable.setNodeRef} dragState={sortable.dragState}>
        <Table.Td>
          <IconButton
            emphasis="low"
            interaction="drag-handle"
            draggable={false}
            {...sortable.handle}
            aria-label={tSort('aria.reorder', { label: getCreditDisplayName(credit) })}
            disabled={!canEdit}
          >
            <IconGripVertical aria-hidden />
          </IconButton>
        </Table.Td>
        <Table.Td>
          <DsText id={creditNameId} size="sm">
            {getCreditDisplayName(credit)}
          </DsText>
        </Table.Td>
        <Table.Td>
          <DsText size="sm" tone="secondary">
            {credit.credit_role || '-'}
          </DsText>
        </Table.Td>
        <Table.Td>
          <DsLayoutInline gap="xxs" wrap="nowrap">
            <DsText size="sm" tone={note ? undefined : 'secondary'} lines={1}>
              {note || '-'}
            </DsText>
            {canEditNote ? (
              <IconButton
                aria-label={tCommon('actions.edit')}
                aria-describedby={creditNameId}
                onClick={() => setNoteModalOpened(true)}
              >
                <IconPencil aria-hidden />
              </IconButton>
            ) : null}
          </DsLayoutInline>
        </Table.Td>
        <Table.Td>
          <IconButton
            tone="danger"
            emphasis="low"
            size="compact"
            aria-label={tCommon('actions.remove')}
            aria-describedby={creditNameId}
            onClick={onRemove}
            disabled={!canEdit}
          >
            <IconX size={14} />
          </IconButton>
        </Table.Td>
      </Table.Tr>

      <ContentModal
        opened={noteModalOpened}
        onClose={() => setNoteModalOpened(false)}
        title={t('fields.noteOptional')}
        size="compact"
        centered
        closeLabel={tModalActions('close')}
      >
        <DsLayoutStack>
          <Textarea
            aria-describedby={creditNameId}
            id={idPrefix ? `${idPrefix}-note-${credit.id}` : undefined}
            label={t('fields.noteOptional')}
            placeholder={t('placeholders.note')}
            value={localNote}
            onChange={(event) => setLocalNote(event.currentTarget.value)}
            autosize
            minRows={3}
            disabled={!canEditNote}
            autoFocus
          />
          <DialogActions>
            <Button emphasis="low" onClick={() => setNoteModalOpened(false)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              emphasis="strong"
              onClick={() => {
                onNoteChange(localNote);
                setNoteModalOpened(false);
              }}
              disabled={!canEditNote}
            >
              {tCommon('actions.save')}
            </Button>
          </DialogActions>
        </DsLayoutStack>
      </ContentModal>
    </>
  );
}
