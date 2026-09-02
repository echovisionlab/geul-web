'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  closestCenter,
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  getFirstCollision,
  pointerWithin,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { IconPlus, IconUserPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Avatar, Box, Divider, Group, Loader, Paper, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { Select, TextInput, SegmentedControl } from '@/components/core/Input';
import { SearchCombobox } from '@/features/search/SearchCombobox';
import { SectionCard } from '@/components/core/Section';
import {
  addWorkCreditAction,
  createWorkCreditGroupAction,
  deleteWorkCreditGroupAction,
  getWorkGroupsWithCreditsAction,
  removeWorkCreditAction,
  searchArtistsForCreditAction,
  updateWorkCreditAction,
  updateWorkCreditGroupAction,
} from '@/lib/actions/work';
import { useWorkMeta } from '@/lib/contexts/WorkMetaContext';
import { useSearchCombobox } from '@/lib/hooks/useSearchCombobox';
import { useSortableSensors } from '@/lib/hooks/useSortableSensors';
import { searchMembers } from '@/lib/queries/user-browser';
import type { CreditOrderItem, FlatDisplayItem } from '@/lib/types/work/credit';
import {
  buildFlatList,
  flatListToOrder,
  getItemId,
  planCreditDrop,
  type CreditDragData,
  type CreditDropData,
} from './credits/credit-order-utils';
import { CreditGroupHeaderSkeleton, CreditSkeleton } from './credits/CreditSkeletons';
import { SortableCreditGroupHeader } from './credits/SortableCreditGroupHeader';
import { SortableCreditRow } from './credits/SortableCreditRow';

// Custom collision detection that excludes the active (dragged) element
const customCollisionDetection: CollisionDetection = (args) => {
  // First try pointerWithin for droppable zones
  const pointerCollisions = pointerWithin(args);
  const pointerCollision = getFirstCollision(pointerCollisions);

  if (pointerCollision && pointerCollision.id !== args.active.id) {
    return [pointerCollision];
  }

  // Fall back to closestCenter but exclude the active element
  const closestCollisions = closestCenter(args);
  const filtered = closestCollisions.filter((c) => c.id !== args.active.id);

  return filtered.length > 0 ? [filtered[0]] : [];
};

// Ungrouped drop zone component - uses useDroppable internally (must be rendered inside DndContext)
function UngroupedDropZone({ label }: { label: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'droppable-ungrouped',
    data: { type: 'ungrouped', groupId: null },
  });

  const style = {
    borderRadius: 'var(--mantine-radius-sm)',
    border: '2px dashed var(--mantine-color-dimmed)',
    backgroundColor: isOver ? 'var(--mantine-color-blue-light)' : 'var(--mantine-color-default)',
    minHeight: 40,
    padding: 'var(--mantine-spacing-md) var(--mantine-spacing-sm)',
    marginTop: 'var(--mantine-spacing-sm)',
    transition: 'background-color 150ms ease',
  };

  return (
    <Box ref={setNodeRef} style={style}>
      <Text size="xs" c="dimmed" ta="center">
        {label}
      </Text>
    </Box>
  );
}

interface WorkCreditsSectionProps {
  workId: string;
  canEdit: boolean;
}

export function WorkCreditsSection({ workId, canEdit }: WorkCreditsSectionProps) {
  const t = useTranslations('workCredits');
  const tCommon = useTranslations('common');
  const tCommonActions = useTranslations('common.actions');
  const tCommonMessages = useTranslations('common.messages');
  const tCommonStates = useTranslations('common.states');
  const [newGroupName, setNewGroupName] = useState('');
  const [searchType, setSearchType] = useState<'artist' | 'member' | 'name'>('artist');
  const [creditRole, setCreditRole] = useState('');
  const [creditName, setCreditName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<FlatDisplayItem | null>(null);

  const { search, setSearch, debouncedSearch, combobox, isEnabled, reset } = useSearchCombobox();
  const sensors = useSortableSensors();

  const { creditsVersion, incrementCreditsVersion, creditOrder, setCreditOrder } = useWorkMeta();
  const prevVersionRef = useRef(creditsVersion);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (prevVersionRef.current !== creditsVersion) {
      prevVersionRef.current = creditsVersion;
      queryClient.invalidateQueries({ queryKey: ['work', 'groupsWithCredits', workId] });
    }
  }, [creditsVersion, workId, queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ['work', 'groupsWithCredits', workId],
    queryFn: () => getWorkGroupsWithCreditsAction(workId),
  });

  // Transform API response to match expected types
  const groups = useMemo(() => {
    if (!data?.groups) {
      return [];
    }
    return data.groups.map((g) => ({
      id: g.id,
      workId: g.workId,
      name: g.name,
      sortOrder: g.sortOrder,
      credits: data.credits
        .filter((c) => c.groupId === g.id)
        .map((c) => ({
          id: c.id,
          groupId: c.groupId,
          name: c.name,
          creditRole: c.creditRole,
          sortOrder: c.sortOrder,
          artist: c.artist,
          member: c.member,
        })),
    }));
  }, [data]);

  const ungrouped = useMemo(() => {
    if (!data?.credits) {
      return [];
    }
    return data.credits
      .filter((c) => !c.groupId)
      .map((c) => ({
        id: c.id,
        groupId: c.groupId,
        name: c.name,
        creditRole: c.creditRole,
        sortOrder: c.sortOrder,
        artist: c.artist,
        member: c.member,
      }));
  }, [data]);

  const flatList = useMemo(() => buildFlatList(creditOrder, groups, ungrouped), [creditOrder, groups, ungrouped]);

  useEffect(() => {
    if (!isLoading && data) {
      const currentOrder = flatListToOrder(flatList);
      if (creditOrder.length === 0 && currentOrder.length > 0) {
        setCreditOrder(currentOrder);
      }
    }
  }, [isLoading, data, flatList, creditOrder.length, setCreditOrder]);

  const { data: artistResults = [], isFetching: artistSearchFetching } = useQuery({
    queryKey: ['work', 'searchArtistsForCredit', workId, debouncedSearch],
    queryFn: () => searchArtistsForCreditAction(workId, debouncedSearch),
    enabled: isEnabled && searchType === 'artist' && canEdit,
  });

  const { data: userResults = [], isFetching: userSearchFetching } = useQuery({
    queryKey: ['users', 'search', debouncedSearch],
    queryFn: () => searchMembers(debouncedSearch),
    enabled: isEnabled && searchType === 'member' && canEdit,
  });

  const searchResults = (searchType === 'artist' ? artistResults : userResults) as Array<{
    id: string;
    name: string;
    imageUrl?: string | null;
    image?: string | null;
  }>;
  const searchFetching = searchType === 'artist' ? artistSearchFetching : userSearchFetching;

  const createGroup = useMutation({
    mutationFn: (name: string) => createWorkCreditGroupAction({ workId, name }),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: t('notifications.groupCreated'), color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['work', 'groupsWithCredits', workId] });
      if (result.group) {
        const newOrder: CreditOrderItem[] = [...creditOrder, { type: 'group', id: result.group.id }];
        setCreditOrder(newOrder);
      }
      incrementCreditsVersion();
      setNewGroupName('');
    },
  });

  const updateGroup = useMutation({
    mutationFn: ({ groupId, name }: { groupId: string; name: string }) =>
      updateWorkCreditGroupAction(groupId, { name }),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['work', 'groupsWithCredits', workId] });
      incrementCreditsVersion();
    },
  });

  const deleteGroup = useMutation({
    mutationFn: (groupId: string) => deleteWorkCreditGroupAction(groupId),
    onMutate: (groupId) => {
      setDeletingGroupId(groupId);
    },
    onSuccess: (result, groupId) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: t('notifications.groupDeleted'), color: 'yellow' });
      queryClient.invalidateQueries({ queryKey: ['work', 'groupsWithCredits', workId] });
      const newOrder = creditOrder.filter((item) => !(item.type === 'group' && item.id === groupId));
      setCreditOrder(newOrder);
      incrementCreditsVersion();
    },
    onSettled: () => {
      setDeletingGroupId(null);
    },
  });

  const addCredit = useMutation({
    mutationFn: (data: {
      groupId?: string | null;
      artistId?: string;
      memberId?: string;
      name?: string;
      creditRole?: string | null;
    }) => addWorkCreditAction({ workId, ...data }),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: t('notifications.creditAdded'), color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['work', 'groupsWithCredits', workId] });

      if (result.creditId) {
        const newItem: CreditOrderItem = {
          type: 'credit',
          id: result.creditId,
          creditType: searchType,
        };

        let newOrder: CreditOrderItem[];
        if (selectedGroupId) {
          const groupIndex = creditOrder.findIndex((item) => item.type === 'group' && item.id === selectedGroupId);
          if (groupIndex !== -1) {
            let insertIndex = groupIndex + 1;
            while (insertIndex < creditOrder.length && creditOrder[insertIndex].type === 'credit') {
              const creditId = creditOrder[insertIndex].id;
              const belongsToGroup = groups
                .find((g) => g.id === selectedGroupId)
                ?.credits.some((c) => c.id === creditId);
              if (!belongsToGroup) {
                break;
              }
              insertIndex++;
            }
            newOrder = [...creditOrder.slice(0, insertIndex), newItem, ...creditOrder.slice(insertIndex)];
          } else {
            newOrder = [...creditOrder, newItem];
          }
        } else {
          newOrder = [...creditOrder, newItem];
        }

        setCreditOrder(newOrder);
      }
      incrementCreditsVersion();
      reset();
      setCreditRole('');
    },
  });

  const removeCredit = useMutation({
    mutationFn: (creditId: string) => removeWorkCreditAction(creditId),
    onMutate: (creditId) => {
      setRemovingId(creditId);
    },
    onSuccess: (result, creditId) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: t('notifications.creditRemoved'), color: 'yellow' });
      queryClient.invalidateQueries({ queryKey: ['work', 'groupsWithCredits', workId] });
      const newOrder = creditOrder.filter((item) => !(item.type === 'credit' && item.id === creditId));
      setCreditOrder(newOrder);
      incrementCreditsVersion();
    },
    onSettled: () => {
      setRemovingId(null);
    },
  });

  const updateCredit = useMutation({
    mutationFn: (data: { creditId: string; groupId?: string | null; creditRole?: string | null }) =>
      updateWorkCreditAction(data.creditId, { groupId: data.groupId, creditRole: data.creditRole }),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['work', 'groupsWithCredits', workId] });
      incrementCreditsVersion();
    },
    onSettled: () => {
      setUpdatingRoleId(null);
    },
  });

  const handleEditRole = (creditId: string, creditRole: string | null) => {
    setUpdatingRoleId(creditId);
    updateCredit.mutate({ creditId, creditRole });
  };

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const item = flatList.find((i) => getItemId(i) === active.id);
      setActiveItem(item ?? null);
    },
    [flatList],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveItem(null);
      const { active, over } = event;
      if (!over) {
        return;
      }

      const plan = planCreditDrop({
        flatList,
        activeId: active.id,
        overId: over.id,
        activeData: active.data.current as CreditDragData | undefined,
        overData: over.data.current as CreditDropData | undefined,
      });
      if (!plan) {
        return;
      }
      if (plan.groupChange) {
        updateCredit.mutate(plan.groupChange);
      }
      if (plan.order) {
        setCreditOrder(plan.order);
      }
      incrementCreditsVersion();
    },
    [flatList, setCreditOrder, incrementCreditsVersion, updateCredit],
  );

  const handleAddCredit = (id: string) => {
    addCredit.mutate({
      groupId: selectedGroupId,
      ...(searchType === 'artist' ? { artistId: id } : { memberId: id }),
      creditRole: creditRole.trim() || null,
    });
  };

  const handleAddByName = () => {
    if (!creditName.trim()) {
      return;
    }
    addCredit.mutate({
      groupId: selectedGroupId,
      name: creditName.trim(),
      creditRole: creditRole.trim() || null,
    });
    setCreditName('');
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      return;
    }
    createGroup.mutate(newGroupName.trim());
  };

  const groupSelectData = [
    { value: '', label: t('fields.noGroup') },
    ...groups.map((g) => ({ value: g.id, label: g.name })),
  ];

  const showSkeleton = isLoading && creditOrder.length > 0;
  const showEmptyState = !isLoading && groups.length === 0 && ungrouped.length === 0;
  const showLoadingSpinner = isLoading && creditOrder.length === 0;

  return (
    <SectionCard withBorder p="md">
      <Group justify="space-between" mb="sm">
        <Text size="sm" fw={500}>
          {tCommon('entities.credits')}
        </Text>
        {canEdit && (
          <Button
            size="xs"
            emphasis="medium"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? tCommonActions('hide') : tCommonActions('add')}
          </Button>
        )}
      </Group>

      {canEdit && showAddForm && (
        <Paper p="sm" mb="sm" bg="var(--mantine-color-default)" radius="sm">
          <Stack gap="xs">
            <Group gap="xs">
              <TextInput
                flex={1}
                size="xs"
                placeholder={t('fields.newGroupName')}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
              />
              <Button
                size="xs"
                emphasis="medium"
                onClick={handleCreateGroup}
                loading={createGroup.isPending}
                disabled={!newGroupName.trim()}
              >
                {t('actions.createGroup')}
              </Button>
            </Group>

            <Divider label={t('divider')} labelPosition="center" />

            <Group gap="xs">
              <SegmentedControl
                size="xs"
                value={searchType}
                onChange={(val) => {
                  setSearchType(val as 'artist' | 'member' | 'name');
                  setSearch('');
                  setCreditName('');
                }}
                data={[
                  { label: tCommon('entities.artist'), value: 'artist' },
                  { label: tCommon('entities.member'), value: 'member' },
                  { label: tCommon('labels.name'), value: 'name' },
                ]}
              />
              <TextInput
                size="xs"
                placeholder={t('fields.rolePlaceholder')}
                value={creditRole}
                onChange={(e) => setCreditRole(e.currentTarget.value)}
                w={120}
              />
              {groups.length > 0 && (
                <Select
                  size="xs"
                  w={120}
                  placeholder={t('fields.groupPlaceholder')}
                  value={selectedGroupId ?? ''}
                  onChange={(val) => setSelectedGroupId(val || null)}
                  data={groupSelectData}
                  clearable
                />
              )}
            </Group>
            {searchType === 'name' ? (
              <Group gap="xs">
                <TextInput
                  flex={1}
                  size="xs"
                  placeholder={t('fields.creditNamePlaceholder')}
                  value={creditName}
                  onChange={(e) => setCreditName(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddByName()}
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
                    <Avatar src={searchType === 'artist' ? item.imageUrl : item.image} size="xs" radius="xl">
                      {item.name?.charAt(0)}
                    </Avatar>
                    <Text size="xs">{item.name}</Text>
                  </Group>
                )}
              />
            )}
          </Stack>
        </Paper>
      )}

      {showLoadingSpinner && (
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      )}

      {showSkeleton && (
        <Stack gap={0}>
          {creditOrder.map((item, index) =>
            item.type === 'group' ? (
              <CreditGroupHeaderSkeleton key={`skeleton-group-${index}`} />
            ) : (
              <CreditSkeleton key={`skeleton-credit-${index}`} />
            ),
          )}
        </Stack>
      )}

      {showEmptyState && (
        <Text size="xs" c="dimmed" ta="center" py="sm">
          {t('empty')}
        </Text>
      )}

      {!isLoading && flatList.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={flatList.map(getItemId)} strategy={verticalListSortingStrategy}>
            <Stack gap={0}>
              {flatList.map((item) =>
                item.type === 'group' ? (
                  <SortableCreditGroupHeader
                    key={`group-${item.group.id}`}
                    group={item.group}
                    canEdit={canEdit}
                    onEdit={(groupId, name) => updateGroup.mutate({ groupId, name })}
                    onDelete={(groupId) => deleteGroup.mutate(groupId)}
                    isDeleting={deletingGroupId === item.group.id}
                  />
                ) : (
                  <SortableCreditRow
                    key={`credit-${item.credit.id}`}
                    credit={item.credit}
                    groupId={item.groupId}
                    canEdit={canEdit}
                    onRemove={(id) => removeCredit.mutate(id)}
                    onEditRole={handleEditRole}
                    isRemoving={removingId === item.credit.id}
                    isUpdating={updatingRoleId === item.credit.id}
                  />
                ),
              )}

              {/* Ungrouped drop zone - shown when there are groups */}
              {groups.length > 0 && <UngroupedDropZone label={t('ungroupedDrop')} />}
            </Stack>
          </SortableContext>

          <DragOverlay>
            {activeItem?.type === 'credit' && (
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
                <Avatar
                  src={activeItem.credit.artist?.imageUrl || activeItem.credit.member?.image || null}
                  size="xs"
                  radius="xl"
                >
                  {(
                    activeItem.credit.artist?.name ||
                    activeItem.credit.member?.name ||
                    activeItem.credit.name ||
                    t('states.unknownInitial')
                  ).charAt(0)}
                </Avatar>
                <Text size="xs">
                  {activeItem.credit.artist?.name ||
                    activeItem.credit.member?.name ||
                    activeItem.credit.name ||
                    tCommonStates('unknown')}
                </Text>
                {(activeItem.credit.artist || activeItem.credit.member) && (
                  <LabelBadge size="xs" tone="accent">
                    {activeItem.credit.artist ? tCommon('entities.artist') : tCommon('entities.member')}
                  </LabelBadge>
                )}
              </Group>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </SectionCard>
  );
}
