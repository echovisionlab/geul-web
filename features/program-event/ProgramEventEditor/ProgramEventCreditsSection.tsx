'use client';

import { useMemo, useState } from 'react';
import { closestCenter, DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { IconPlus, IconUserPlus } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Avatar, Divider, Group, Loader, Paper, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { TextInput, SegmentedControl } from '@/components/core/Input';
import { SearchCombobox } from '@/features/search/SearchCombobox';
import { SectionCard } from '@/components/core/Section';
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
  const tCommonStates = useTranslations('common.states');
  const [credits, setCredits] = useState(() => sortCredits(initialCredits));
  const [searchType, setSearchType] = useState<CreditSearchType>('artist');
  const [creditRole, setCreditRole] = useState('');
  const [creditName, setCreditName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [activeCredit, setActiveCredit] = useState<WorkCreditWithDetails | null>(null);
  const { search, setSearch, debouncedSearch, combobox, isEnabled, reset } = useSearchCombobox();
  const sensors = useSortableSensors();

  const sortableCredits = useMemo(() => credits.map(toSortableCredit), [credits]);

  const { data: artistResults = [], isFetching: artistSearchFetching } = useQuery({
    queryKey: ['program-event', 'searchArtistsForCredit', eventId, debouncedSearch],
    queryFn: () => searchArtistsForProgramEventCreditAction(eventId, debouncedSearch),
    enabled: isEnabled && searchType === 'artist' && canEdit,
  });

  const { data: memberResults = [], isFetching: memberSearchFetching } = useQuery({
    queryKey: ['users', 'search', debouncedSearch],
    queryFn: () => searchMembers(debouncedSearch),
    enabled: isEnabled && searchType === 'member' && canEdit,
  });

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
          color: 'red',
        });
        return;
      }
      setCredits((current) => sortCredits([...current, result.credit!]));
      reset();
      setCreditName('');
      setCreditRole('');
      notifications.show({ message: t('notifications.creditAdded'), color: 'green' });
    },
  });

  const updateCredit = useMutation({
    mutationFn: (data: { creditId: string; creditRole: string | null }) =>
      updateProgramEventCreditAction(eventId, data.creditId, { creditRole: data.creditRole }),
    onSuccess: (result) => {
      if (result.error || !result.credit) {
        notifications.show({
          message: result.error ?? tCommon('notifications.saveFailed'),
          color: 'red',
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
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      setCredits((current) =>
        current.filter((credit) => credit.id !== creditId).map((credit, index) => ({ ...credit, sortOrder: index })),
      );
      notifications.show({ message: t('notifications.creditRemoved'), color: 'yellow' });
    },
    onSettled: () => setRemovingId(null),
  });

  const reorderCredits = useMutation({
    mutationFn: (creditIds: string[]) => reorderProgramEventCreditsAction(eventId, creditIds),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
      }
    },
  });

  const handleAddCredit = (id: string) => {
    if (searchType === 'artist') {
      addCredit.mutate({ artistId: id });
      return;
    }
    addCredit.mutate({ memberId: id });
  };

  const handleAddByName = () => {
    const name = creditName.trim();
    if (!name) {
      return;
    }
    addCredit.mutate({ displayName: name });
  };

  const handleEditRole = (creditId: string, nextRole: string | null) => {
    setUpdatingRoleId(creditId);
    updateCredit.mutate({ creditId, creditRole: nextRole });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const creditId = String(event.active.id).replace(/^credit-/, '');
    setActiveCredit(sortableCredits.find((credit) => credit.id === creditId) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCredit(null);
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
    <SectionCard withBorder p="md">
      <Group justify="space-between" mb="sm">
        <Text size="sm" fw={500}>
          {tCommon('entities.credits')}
        </Text>
        {canEdit ? (
          <Button
            size="xs"
            emphasis="medium"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowAddForm((value) => !value)}
          >
            {showAddForm ? tCommonActions('hide') : tCommonActions('add')}
          </Button>
        ) : null}
      </Group>

      {canEdit && showAddForm ? (
        <Paper p="sm" mb="sm" bg="var(--mantine-color-default)" radius="sm">
          <Stack gap="xs">
            <Group gap="xs">
              <SegmentedControl
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
              <TextInput
                size="xs"
                placeholder={t('fields.rolePlaceholder')}
                value={creditRole}
                onChange={(event) => setCreditRole(event.currentTarget.value)}
                w={160}
              />
            </Group>
            <Divider label={t('divider')} labelPosition="center" />
            {searchType === 'name' ? (
              <Group gap="xs">
                <TextInput
                  flex={1}
                  size="xs"
                  placeholder={t('fields.creditNamePlaceholder')}
                  value={creditName}
                  onChange={(event) => setCreditName(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
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
              </Group>
            ) : (
              <SearchCombobox
                combobox={combobox}
                search={search}
                onSearchChange={setSearch}
                placeholder={searchType === 'member' ? t('searchPlaceholders.user') : t('searchPlaceholders.artist')}
                leftSection={<IconUserPlus size={14} />}
                items={searchResults}
                isLoading={searchFetching}
                debouncedSearch={debouncedSearch}
                onSelect={handleAddCredit}
                getItemId={(item) => item.id}
                emptyMessage={
                  searchType === 'member' ? tCommonMessages('noUsersFound') : t(`emptyResults.${searchType}`)
                }
                renderItem={(item) => (
                  <Group gap="sm">
                    <Avatar src={item.imageUrl} size="xs" radius="xl">
                      {item.name?.charAt(0)}
                    </Avatar>
                    <Text size="xs">{item.name}</Text>
                  </Group>
                )}
              />
            )}
          </Stack>
        </Paper>
      ) : null}

      {credits.length === 0 ? (
        <Text size="xs" c="dimmed" ta="center" py="sm">
          {t('empty')}
        </Text>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableCredits.map((credit) => `credit-${credit.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <Stack gap={0}>
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
            </Stack>
          </SortableContext>

          <DragOverlay>
            {activeCredit ? (
              <Group
                gap="xs"
                py={4}
                px="xs"
                style={{
                  backgroundColor: 'var(--mantine-color-body)',
                  borderRadius: 'var(--mantine-radius-sm)',
                  boxShadow: 'var(--mantine-shadow-sm)',
                }}
              >
                <Avatar src={activeCredit.artist?.imageUrl || activeCredit.member?.image || null} size="xs" radius="xl">
                  {(
                    activeCredit.artist?.name ||
                    activeCredit.member?.name ||
                    activeCredit.name ||
                    t('states.unknownInitial')
                  ).charAt(0)}
                </Avatar>
                <Text size="xs">
                  {activeCredit.artist?.name ||
                    activeCredit.member?.name ||
                    activeCredit.name ||
                    tCommonStates('unknown')}
                </Text>
                {(activeCredit.artist || activeCredit.member) && (
                  <LabelBadge size="xs" tone="accent">
                    {activeCredit.artist ? tCommon('entities.artist') : tCommon('entities.user')}
                  </LabelBadge>
                )}
              </Group>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {reorderCredits.isPending ? (
        <Group justify="flex-end" mt="xs">
          <Loader size="xs" />
        </Group>
      ) : null}
    </SectionCard>
  );
}
