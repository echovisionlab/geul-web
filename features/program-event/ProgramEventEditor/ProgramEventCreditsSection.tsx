'use client';
import { SectionCard as DsSectionCard, SectionCard } from '@/components/core/Section';
import {
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { useId, useMemo, useState } from 'react';
import { closestCenter, DndContext, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { IconPlus, IconUserPlus } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Avatar, Separator as Divider, Spinner as Loader } from '@/components/core/Display';
import { notifications } from '@/components/core/Notification';
import { Button } from '@/components/core/Button';
import { TextInput, SegmentedControl } from '@/components/core/Input';
import { SearchCombobox } from '@/features/search/SearchCombobox';

import { SortableCreditRow } from '@/features/work/WorkEditor/credits/SortableCreditRow';
import {
  addProgramEventCreditAction,
  deleteProgramEventCreditAction,
  reorderProgramEventCreditsAction,
  searchArtistsForProgramEventCreditAction,
  updateProgramEventCreditAction,
  type ProgramEventCreditItem,
} from '@/lib/actions/program-event';
import { useSearchCombobox } from '@/lib/hooks/useSearchCombobox';
import { useSortableSensors } from '@/lib/hooks/useSortableSensors';
import { searchMembers } from '@/lib/queries/user-browser';
import type { WorkCreditWithDetails } from '@/lib/types/work/credit';

type CreditSearchType = 'artist' | 'member' | 'name';
type CreditSearchResult = { id: string; name: string; imageUrl: string | null };

interface ProgramEventCreditsSectionProps {
  eventId: string;
  canEdit: boolean;
  initialCredits: ProgramEventCreditItem[];
}

function toSortableCredit(credit: ProgramEventCreditItem): WorkCreditWithDetails {
  return {
    id: credit.id,
    groupId: null,
    name: credit.displayName,
    creditRole: credit.creditRole,
    sortOrder: credit.sortOrder,
    artist: credit.artist,
    member: credit.member,
  };
}

function sortCredits(credits: ProgramEventCreditItem[]): ProgramEventCreditItem[] {
  return [...credits].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function ProgramEventCreditsSection({ eventId, canEdit, initialCredits }: ProgramEventCreditsSectionProps) {
  const t = useTranslations('workCredits');
  const tCommon = useTranslations('common');
  const tCommonActions = useTranslations('common.actions');
  const tCommonMessages = useTranslations('common.messages');
  const [credits, setCredits] = useState(() => sortCredits(initialCredits));
  const [searchType, setSearchType] = useState<CreditSearchType>('artist');
  const [creditRole, setCreditRole] = useState('');
  const [creditName, setCreditName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const addFormId = useId();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const { search, setSearch, debouncedSearch, combobox, isEnabled, reset } = useSearchCombobox();
  const sensors = useSortableSensors();

  const sortableCredits = useMemo(() => credits.map(toSortableCredit), [credits]);

  const artistResultsQuery = useQuery({
    queryKey: ['program-event', 'searchArtistsForCredit', eventId, debouncedSearch],
    queryFn: () => searchArtistsForProgramEventCreditAction(eventId, debouncedSearch).then(unwrapQueryResult),
    enabled: isEnabled && searchType === 'artist' && canEdit,
  });
  const { data: artistResults = [], isFetching: artistSearchFetching } = artistResultsQuery;

  const memberResultsQuery = useQuery({
    queryKey: ['users', 'search', debouncedSearch],
    queryFn: () => searchMembers(debouncedSearch),
    enabled: isEnabled && searchType === 'member' && canEdit,
  });
  const { data: memberResults = [], isFetching: memberSearchFetching } = memberResultsQuery;

  const normalizedMemberResults = useMemo<CreditSearchResult[]>(
    () =>
      memberResults.map((member) => ({
        id: member.id,
        name: member.nickname,
        imageUrl: member.avatarUrl,
      })),
    [memberResults],
  );
  const searchResults: CreditSearchResult[] = searchType === 'artist' ? artistResults : normalizedMemberResults;
  const searchFetching = searchType === 'artist' ? artistSearchFetching : memberSearchFetching;

  const addCredit = useMutation({
    mutationFn: (data: { artistId?: string; memberId?: string; displayName?: string }) =>
      addProgramEventCreditAction(eventId, {
        ...data,
        creditRole: creditRole.trim() || null,
        sortOrder: credits.length,
      }),
    onSuccess: (result) => {
      if (result.error || !result.credit) {
        notifications.show({
          message: result.error ?? tCommon('notifications.saveFailed'),
          tone: 'danger',
        });
        return;
      }
      setCredits((current) => sortCredits([...current, result.credit!]));
      reset();
      setCreditName('');
      setCreditRole('');
      notifications.show({ message: t('notifications.creditAdded'), tone: 'positive' });
    },
  });

  const updateCredit = useMutation({
    mutationFn: (data: { creditId: string; creditRole: string | null }) =>
      updateProgramEventCreditAction(eventId, data.creditId, { creditRole: data.creditRole }),
    onSuccess: (result) => {
      if (result.error || !result.credit) {
        notifications.show({
          message: result.error ?? tCommon('notifications.saveFailed'),
          tone: 'danger',
        });
        return;
      }
      setCredits((current) =>
        sortCredits(current.map((credit) => (credit.id === result.credit!.id ? result.credit! : credit))),
      );
    },
    onSettled: () => setUpdatingRoleId(null),
  });

  const removeCredit = useMutation({
    mutationFn: (creditId: string) => deleteProgramEventCreditAction(eventId, creditId),
    onMutate: (creditId) => setRemovingId(creditId),
    onSuccess: (result, creditId) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      setCredits((current) =>
        current.filter((credit) => credit.id !== creditId).map((credit, index) => ({ ...credit, sortOrder: index })),
      );
      notifications.show({ message: t('notifications.creditRemoved'), tone: 'positive' });
    },
    onSettled: () => setRemovingId(null),
  });

  const reorderCredits = useMutation({
    mutationFn: (creditIds: string[]) => reorderProgramEventCreditsAction(eventId, creditIds),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
      }
    },
  });

  const handleAddCredit = (id: string) => {
    if (!canEdit || addCredit.isPending) {
      return;
    }
    if (searchType === 'artist') {
      addCredit.mutate({ artistId: id });
      return;
    }
    addCredit.mutate({ memberId: id });
  };

  const handleAddByName = () => {
    if (!canEdit || addCredit.isPending) {
      return;
    }
    const name = creditName.trim();
    if (!name) {
      return;
    }
    addCredit.mutate({ displayName: name });
  };

  const handleEditRole = (creditId: string, nextRole: string | null) => {
    if (!canEdit || addCredit.isPending) {
      return;
    }
    setUpdatingRoleId(creditId);
    updateCredit.mutate({ creditId, creditRole: nextRole });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canEdit || addCredit.isPending) {
      return;
    }
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const activeId = String(active.id).replace(/^credit-/, '');
    const overId = String(over.id).replace(/^credit-/, '');
    const oldIndex = credits.findIndex((credit) => credit.id === activeId);
    const newIndex = credits.findIndex((credit) => credit.id === overId);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }
    const reordered = arrayMove(credits, oldIndex, newIndex).map((credit, index) => ({
      ...credit,
      sortOrder: index,
    }));
    setCredits(reordered);
    reorderCredits.mutate(reordered.map((credit) => credit.id));
  };

  return (
    <SectionCard withBorder padding="md">
      <QueryErrorAlert queries={[memberResultsQuery, artistResultsQuery]} />
      <DsLayoutInset blockEnd="sm">
        <DsLayoutInline justify="between">
          <DsText size="sm" weight="medium">
            {tCommon('entities.credits')}
          </DsText>
          {canEdit ? (
            <Button
              size="xs"
              emphasis="medium"
              leftSection={<IconPlus size={14} />}
              onClick={() => setShowAddForm((value) => !value)}
              aria-expanded={showAddForm}
              aria-controls={showAddForm ? addFormId : undefined}
            >
              {showAddForm ? tCommonActions('hide') : tCommonActions('add')}
            </Button>
          ) : null}
        </DsLayoutInline>
      </DsLayoutInset>

      {canEdit && showAddForm ? (
        <DsSectionCard
          id={addFormId}
          padding="sm"
          appearance="muted"
          role="group"
          aria-label={tCommon('entities.credits')}
        >
          <DsLayoutStack gap="xs">
            <DsLayoutInline gap="xs">
              <SegmentedControl
                aria-label={tCommon('entities.credit')}
                size="xs"
                value={searchType}
                onChange={(value) => {
                  setSearchType(value as CreditSearchType);
                  setSearch('');
                  setCreditName('');
                }}
                data={[
                  { label: tCommon('entities.artist'), value: 'artist' },
                  { label: tCommon('entities.user'), value: 'member' },
                  { label: tCommon('labels.name'), value: 'name' },
                ]}
              />
              <div style={{ width: 160 }}>
                <TextInput
                  size="xs"
                  aria-label={tCommon('labels.role')}
                  placeholder={t('fields.rolePlaceholder')}
                  value={creditRole}
                  onChange={(event) => setCreditRole(event.currentTarget.value)}
                />
              </div>
            </DsLayoutInline>
            <Divider label={t('divider')} labelPosition="center" />
            {searchType === 'name' ? (
              <DsLayoutInline gap="xs">
                <TextInput
                  grow
                  size="xs"
                  aria-label={tCommon('labels.name')}
                  placeholder={t('fields.creditNamePlaceholder')}
                  value={creditName}
                  onChange={(event) => setCreditName(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      handleAddByName();
                    }
                  }}
                  leftSection={<IconUserPlus size={14} />}
                />
                <Button
                  size="xs"
                  emphasis="medium"
                  onClick={handleAddByName}
                  loading={addCredit.isPending}
                  disabled={!creditName.trim()}
                >
                  {tCommonActions('add')}
                </Button>
              </DsLayoutInline>
            ) : (
              <SearchCombobox
                combobox={combobox}
                search={search}
                onSearchChange={setSearch}
                placeholder={searchType === 'member' ? t('searchPlaceholders.user') : t('searchPlaceholders.artist')}
                leftSection={<IconUserPlus size={14} />}
                items={searchResults}
                isLoading={searchFetching || addCredit.isPending}
                disabled={addCredit.isPending}
                debouncedSearch={debouncedSearch}
                onSelect={handleAddCredit}
                getItemId={(item) => item.id}
                getItemText={(item) => item.name ?? ''}
                emptyMessage={
                  searchType === 'member' ? tCommonMessages('noUsersFound') : t(`emptyResults.${searchType}`)
                }
                renderItem={(item) => (
                  <DsLayoutInline gap="sm">
                    <Avatar src={item.imageUrl} size="xs" shape="circle" name={item.name} />
                    <DsText size="xs">{item.name}</DsText>
                  </DsLayoutInline>
                )}
              />
            )}
          </DsLayoutStack>
        </DsSectionCard>
      ) : null}

      {credits.length === 0 ? (
        <DsLayoutInset block="sm">
          <DsText size="xs" tone="secondary" align="center">
            {t('empty')}
          </DsText>
        </DsLayoutInset>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sortableCredits.map((credit) => `credit-${credit.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <DsLayoutStack gap="none">
              {sortableCredits.map((credit) => (
                <SortableCreditRow
                  key={credit.id}
                  credit={credit}
                  groupId={null}
                  canEdit={canEdit}
                  onRemove={(id) => removeCredit.mutate(id)}
                  onEditRole={handleEditRole}
                  isRemoving={removingId === credit.id}
                  isUpdating={updatingRoleId === credit.id}
                />
              ))}
            </DsLayoutStack>
          </SortableContext>
        </DndContext>
      )}

      {reorderCredits.isPending ? (
        <DsLayoutInset blockStart="xs">
          <DsLayoutInline justify="end">
            <Loader size="xs" />
          </DsLayoutInline>
        </DsLayoutInset>
      ) : null}
    </SectionCard>
  );
}
