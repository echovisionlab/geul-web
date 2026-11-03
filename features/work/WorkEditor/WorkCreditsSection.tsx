'use client';
import { SectionCard as DsSectionCard, SectionCard } from '@/components/core/Section';
import { Text as DsText } from '@/components/core/Typography';
import {
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  closestCenter,
  CollisionDetection,
  DndContext,
  DragEndEvent,
  getFirstCollision,
  pointerWithin,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { IconPlus, IconUserPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Avatar, Separator as Divider } from '@/components/core/Display';
import { notifications } from '@/components/core/Notification';
import { Button } from '@/components/core/Button';
import { Select, TextInput, SegmentedControl } from '@/components/core/Input';
import { SearchCombobox } from '@/features/search/SearchCombobox';

import {
  addWorkCreditAction,
  createWorkCreditGroupAction,
  deleteWorkCreditGroupAction,
  getWorkGroupsWithCreditsAction,
  moveWorkCreditItemAction,
  removeWorkCreditAction,
  searchArtistsForCreditAction,
  updateWorkCreditAction,
  updateWorkCreditGroupAction,
} from '@/lib/actions/work';
import { useWorkMeta } from '@/lib/contexts/WorkMetaContext';
import { publishEditorEntityChange, useEditorEntityChanges } from '@/lib/editor/editor-entity-changes';
import { useSearchCombobox } from '@/lib/hooks/useSearchCombobox';
import { useSortableSensors } from '@/lib/hooks/useSortableSensors';
import { searchMembers } from '@/lib/queries/user-browser';
import type { CreditOrderItem } from '@/lib/types/work/credit';
import { WorkCreditSaveCoordinator } from './credits/work-credit-save-coordinator';
import { useAuthoritativeConfiguration } from '@/lib/editor/useAuthoritativeConfiguration';
import {
  buildFlatList,
  creditMoveIntentFromDropPlan,
  getItemId,
  planCreditDrop,
  type CreditDragData,
  type CreditDropData,
} from './credits/credit-order-utils';
import { PageLoader } from '@/features/site/PageLoader';
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

  return (
    <DsLayoutInset blockStart="sm">
      <DsSectionCard
        ref={setNodeRef}
        padding="sm"
        withBorder
        appearance="muted"
        state={isOver ? 'drop-target' : 'default'}
      >
        <DsText size="xs" tone="secondary" align="center">
          {label}
        </DsText>
      </DsSectionCard>
    </DsLayoutInset>
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
  const [newGroupName, setNewGroupName] = useState('');
  const [searchType, setSearchType] = useState<'artist' | 'member' | 'name'>('artist');
  const [creditRole, setCreditRole] = useState('');
  const [creditName, setCreditName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const addFormId = useId();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  const { search, setSearch, debouncedSearch, combobox, isEnabled, reset } = useSearchCombobox();
  const sensors = useSortableSensors();

  const { creditsVersion, incrementCreditsVersion, creditOrder, setCreditOrder } = useWorkMeta();
  const prevVersionRef = useRef(creditsVersion);
  const creditOrderRef = useRef(creditOrder);
  const moveSequenceRef = useRef(0);
  const pendingMoveCountRef = useRef(0);
  const moveQueueRef = useRef(Promise.resolve());
  const creditSaveCoordinatorRef = useRef<WorkCreditSaveCoordinator | null>(null);
  const [, setPendingMoveCount] = useState(0);
  const creditConfiguration = useAuthoritativeConfiguration<{
    data: Awaited<ReturnType<typeof getWorkGroupsWithCreditsAction>> | undefined;
    order: CreditOrderItem[];
    groupOverrides: Record<string, string | null>;
  }>({
    document: `work:${workId}`,
    initialConfiguration: { data: undefined, order: creditOrder, groupOverrides: {} },
    onAdopt: (patch) => {
      if (patch.order) {
        creditOrderRef.current = patch.order;
        setCreditOrder(patch.order);
      }
      if (patch.groupOverrides) {
        creditGroupOverridesRef.current = patch.groupOverrides;
      }
    },
  });
  const { data, groupOverrides: creditGroupOverrides } = creditConfiguration.getConfiguration();
  const creditGroupOverridesRef = useRef<Record<string, string | null>>({});

  const queryClient = useQueryClient();
  const creditsQueryKey = useMemo(() => ['work', 'groupsWithCredits', workId] as const, [workId]);
  useEffect(() => {
    const coordinator = new WorkCreditSaveCoordinator(`work:${workId}`);
    creditSaveCoordinatorRef.current = coordinator;
    return () => {
      if (creditSaveCoordinatorRef.current === coordinator) {
        creditSaveCoordinatorRef.current = null;
      }
      coordinator.dispose();
    };
  }, [workId]);
  const trackCreditOperation = useCallback(
    <T,>(operation: () => Promise<T>, isSuccessful: (value: T) => boolean) => {
      if (!canEdit) {
        return Promise.resolve(false);
      }
      const coordinator = creditSaveCoordinatorRef.current;
      if (coordinator) {
        return coordinator.track(operation, isSuccessful);
      }
      try {
        return Promise.resolve(operation()).then(
          (value) => {
            try {
              return isSuccessful(value);
            } catch {
              return false;
            }
          },
          () => false,
        );
      } catch {
        return Promise.resolve(false);
      }
    },
    [canEdit],
  );
  const trackCreditMutation = useCallback(
    <T extends { error?: string }>(operation: () => Promise<T>) =>
      trackCreditOperation(operation, (result) => !result.error),
    [trackCreditOperation],
  );
  const setLocalCreditOrder = useCallback(
    (order: CreditOrderItem[]) => {
      creditOrderRef.current = order;
      creditConfiguration.edit({ order });
    },
    [creditConfiguration],
  );
  const setLocalCreditGroupOverrides = useCallback(
    (overrides: Record<string, string | null>) => {
      creditGroupOverridesRef.current = overrides;
      creditConfiguration.edit({ groupOverrides: overrides });
    },
    [creditConfiguration],
  );
  const announceCreditsChange = useCallback(() => {
    publishEditorEntityChange(`work:${workId}`);
  }, [workId]);

  useEffect(() => {
    creditOrderRef.current = creditOrder;
  }, [creditOrder]);

  useEffect(() => {
    if (prevVersionRef.current !== creditsVersion) {
      prevVersionRef.current = creditsVersion;
      queryClient.invalidateQueries({ queryKey: creditsQueryKey });
    }
  }, [creditsVersion, creditsQueryKey, queryClient]);

  useEditorEntityChanges(
    `work:${workId}`,
    () => {
      void queryClient.invalidateQueries({ queryKey: creditsQueryKey });
    },
    undefined,
    undefined,
    creditConfiguration.captureOwnChange,
  );

  const creditsQuery = useQuery({
    queryKey: creditsQueryKey,
    queryFn: async () => {
      const read = creditConfiguration.beginRead();
      const result = await getWorkGroupsWithCreditsAction(workId);
      if (result.error) {
        throw new Error(tCommonMessages('failedToLoad'));
      }
      creditConfiguration.adoptRead(read, { data: result, order: result.order, groupOverrides: {} });
      return result;
    },
  });

  const { isLoading } = creditsQuery;

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
        .filter((c) => (Object.hasOwn(creditGroupOverrides, c.id) ? creditGroupOverrides[c.id] : c.groupId) === g.id)
        .map((c) => ({
          id: c.id,
          groupId: Object.hasOwn(creditGroupOverrides, c.id) ? creditGroupOverrides[c.id] : c.groupId,
          name: c.name,
          creditRole: c.creditRole,
          sortOrder: c.sortOrder,
          artist: c.artist,
          member: c.member,
        })),
    }));
  }, [data, creditGroupOverrides]);

  const ungrouped = useMemo(() => {
    if (!data?.credits) {
      return [];
    }
    return data.credits
      .filter((c) => !(Object.hasOwn(creditGroupOverrides, c.id) ? creditGroupOverrides[c.id] : c.groupId))
      .map((c) => ({
        id: c.id,
        groupId: Object.hasOwn(creditGroupOverrides, c.id) ? creditGroupOverrides[c.id] : c.groupId,
        name: c.name,
        creditRole: c.creditRole,
        sortOrder: c.sortOrder,
        artist: c.artist,
        member: c.member,
      }));
  }, [data, creditGroupOverrides]);

  const flatList = useMemo(() => buildFlatList(creditOrder, groups, ungrouped), [creditOrder, groups, ungrouped]);

  const artistResultsQuery = useQuery({
    queryKey: ['work', 'searchArtistsForCredit', workId, debouncedSearch],
    queryFn: () => searchArtistsForCreditAction(workId, debouncedSearch).then(unwrapQueryResult),
    enabled: isEnabled && searchType === 'artist' && canEdit,
  });
  const { data: artistResults = [], isFetching: artistSearchFetching } = artistResultsQuery;

  const userResultsQuery = useQuery({
    queryKey: ['users', 'search', debouncedSearch],
    queryFn: () => searchMembers(debouncedSearch),
    enabled: isEnabled && searchType === 'member' && canEdit,
  });
  const { data: userResults = [], isFetching: userSearchFetching } = userResultsQuery;

  const searchResults = (searchType === 'artist' ? artistResults : userResults) as Array<{
    id: string;
    name: string;
    imageUrl?: string | null;
    image?: string | null;
  }>;
  const searchFetching = searchType === 'artist' ? artistSearchFetching : userSearchFetching;

  const writeCreditMutation = async <T extends { error?: string }>(operation: (origin: string) => Promise<T>) => {
    const write = creditConfiguration.beginWrite(['data']);
    try {
      const result = await operation(write.origin);
      if (result.error) {
        write.fail();
      } else {
        write.acknowledge({}, { authoritative: false });
      }
      return result;
    } catch (error) {
      write.fail();
      throw error;
    }
  };

  const createGroup = useMutation({
    mutationFn: (name: string) =>
      writeCreditMutation((origin) => createWorkCreditGroupAction({ workId, name }, origin)),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: t('notifications.groupCreated'), tone: 'positive' });
      queryClient.invalidateQueries({ queryKey: ['work', 'groupsWithCredits', workId] });
      announceCreditsChange();
      incrementCreditsVersion();
      setNewGroupName('');
    },
  });

  const updateGroup = useMutation({
    mutationFn: ({ groupId, name }: { groupId: string; name: string }) =>
      writeCreditMutation((origin) => updateWorkCreditGroupAction(groupId, { name }, origin)),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['work', 'groupsWithCredits', workId] });
      announceCreditsChange();
      incrementCreditsVersion();
    },
  });

  const deleteGroup = useMutation({
    mutationFn: (groupId: string) => writeCreditMutation((origin) => deleteWorkCreditGroupAction(groupId, origin)),
    onMutate: (groupId) => {
      setDeletingGroupId(groupId);
    },
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: t('notifications.groupDeleted'), tone: 'positive' });
      queryClient.invalidateQueries({ queryKey: ['work', 'groupsWithCredits', workId] });
      announceCreditsChange();
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
    }) => writeCreditMutation((origin) => addWorkCreditAction({ workId, ...data }, origin)),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: t('notifications.creditAdded'), tone: 'positive' });
      queryClient.invalidateQueries({ queryKey: ['work', 'groupsWithCredits', workId] });
      announceCreditsChange();
      incrementCreditsVersion();
      reset();
      setCreditRole('');
    },
  });

  const removeCredit = useMutation({
    mutationFn: (creditId: string) => writeCreditMutation((origin) => removeWorkCreditAction(creditId, origin)),
    onMutate: (creditId) => {
      setRemovingId(creditId);
    },
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: t('notifications.creditRemoved'), tone: 'positive' });
      queryClient.invalidateQueries({ queryKey: ['work', 'groupsWithCredits', workId] });
      announceCreditsChange();
      incrementCreditsVersion();
    },
    onSettled: () => {
      setRemovingId(null);
    },
  });

  const updateCredit = useMutation({
    mutationFn: (data: { creditId: string; creditRole?: string | null }) =>
      writeCreditMutation((origin) => updateWorkCreditAction(data.creditId, { creditRole: data.creditRole }, origin)),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['work', 'groupsWithCredits', workId] });
      announceCreditsChange();
      incrementCreditsVersion();
    },
    onSettled: () => {
      setUpdatingRoleId(null);
    },
  });

  const handleEditRole = (creditId: string, creditRole: string | null) => {
    setUpdatingRoleId(creditId);
    void trackCreditMutation(() => updateCredit.mutateAsync({ creditId, creditRole }));
  };

  const adoptMoveOrder = useCallback(
    (entries: NonNullable<Awaited<ReturnType<typeof moveWorkCreditItemAction>>['order']>) => {
      const currentCreditTypes = new Map(
        creditOrderRef.current.flatMap((item) => (item.type === 'credit' ? [[item.id, item.creditType] as const] : [])),
      );
      const nextOrder: CreditOrderItem[] = entries.map((entry) =>
        entry.kind === 'group'
          ? { type: 'group', id: entry.id }
          : { type: 'credit', id: entry.id, creditType: currentCreditTypes.get(entry.id) ?? 'name' },
      );
      const nextGroups: Record<string, string | null> = {};
      for (const entry of entries) {
        if (entry.kind === 'credit') {
          nextGroups[entry.id] = entry.groupId ?? null;
        }
      }
      return { order: nextOrder, groupOverrides: nextGroups };
    },
    [],
  );

  const enqueueMoveIntent = useCallback(
    (
      intent: NonNullable<ReturnType<typeof creditMoveIntentFromDropPlan>>,
      optimisticOrder: CreditOrderItem[] | undefined,
      groupChange: { creditId: string; groupId: string | null } | undefined,
    ) => {
      const sequence = ++moveSequenceRef.current;
      pendingMoveCountRef.current++;
      setPendingMoveCount(pendingMoveCountRef.current);
      if (optimisticOrder) {
        setLocalCreditOrder(optimisticOrder);
      }
      if (groupChange) {
        setLocalCreditGroupOverrides({
          ...creditGroupOverridesRef.current,
          [groupChange.creditId]: groupChange.groupId,
        });
      }

      const write = creditConfiguration.beginWrite(['data', 'order', 'groupOverrides']);
      const run = moveQueueRef.current.then(async () => {
        const result = await moveWorkCreditItemAction(workId, intent, write.origin);
        if (result.error || !result.order) {
          write.fail();
          if (sequence === moveSequenceRef.current) {
            creditConfiguration.discard(['order', 'groupOverrides']);
          }
          notifications.show({ message: result.error ?? tCommon('notifications.saveFailed'), tone: 'danger' });
          void queryClient.invalidateQueries({ queryKey: creditsQueryKey });
          return false;
        }
        write.acknowledge(adoptMoveOrder(result.order), { authoritative: false });
        announceCreditsChange();
        incrementCreditsVersion();
        return true;
      });
      const queuedRun = run
        .catch((error: unknown) => {
          write.fail();
          if (sequence === moveSequenceRef.current) {
            creditConfiguration.discard(['order', 'groupOverrides']);
          }
          notifications.show({
            message: error instanceof Error ? error.message : tCommon('notifications.saveFailed'),
            tone: 'danger',
          });
          void queryClient.invalidateQueries({ queryKey: creditsQueryKey });
          return false;
        })
        .finally(() => {
          pendingMoveCountRef.current = Math.max(0, pendingMoveCountRef.current - 1);
          setPendingMoveCount(pendingMoveCountRef.current);
        });
      moveQueueRef.current = queuedRun.then(() => undefined);
      void trackCreditOperation(
        () => queuedRun,
        (succeeded) => succeeded,
      );
    },
    [
      adoptMoveOrder,
      announceCreditsChange,
      creditsQueryKey,
      creditConfiguration,
      incrementCreditsVersion,
      queryClient,
      setLocalCreditGroupOverrides,
      setLocalCreditOrder,
      trackCreditOperation,
      tCommon,
      workId,
    ],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!canEdit || !over || !active.data.current) {
        return;
      }

      const activeData = active.data.current as CreditDragData;
      const plan = planCreditDrop({
        flatList,
        activeId: active.id,
        overId: over.id,
        activeData,
        overData: over.data.current as CreditDropData | undefined,
      });
      if (!plan || (!plan.order && !plan.groupChange)) {
        return;
      }
      const intent = creditMoveIntentFromDropPlan(plan, activeData, flatList);
      if (!intent) {
        return;
      }
      enqueueMoveIntent(intent, plan.order, plan.groupChange);
    },
    [canEdit, enqueueMoveIntent, flatList],
  );

  const handleAddCredit = (id: string) => {
    void trackCreditMutation(() =>
      addCredit.mutateAsync({
        groupId: selectedGroupId,
        ...(searchType === 'artist' ? { artistId: id } : { memberId: id }),
        creditRole: creditRole.trim() || null,
      }),
    );
  };

  const handleAddByName = () => {
    if (!creditName.trim()) {
      return;
    }
    void trackCreditMutation(() =>
      addCredit.mutateAsync({
        groupId: selectedGroupId,
        name: creditName.trim(),
        creditRole: creditRole.trim() || null,
      }),
    ).then((saved) => {
      if (saved) {
        setCreditName('');
      }
    });
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      return;
    }
    void trackCreditMutation(() => createGroup.mutateAsync(newGroupName.trim()));
  };

  const groupSelectData = [
    { value: '', label: t('fields.noGroup') },
    ...groups.map((g) => ({ value: g.id, label: g.name })),
  ];

  const showEmptyState = !isLoading && !creditsQuery.isError && groups.length === 0 && ungrouped.length === 0;

  return (
    <SectionCard withBorder padding="md">
      <QueryErrorAlert queries={[creditsQuery, userResultsQuery, artistResultsQuery]} />
      <DsLayoutInset blockEnd="sm">
        <DsLayoutInline justify="between">
          <DsText size="sm" weight="medium">
            {tCommon('entities.credits')}
          </DsText>
          {canEdit && (
            <Button
              size="xs"
              emphasis="medium"
              leftSection={<IconPlus size={14} />}
              onClick={() => setShowAddForm(!showAddForm)}
              aria-expanded={showAddForm}
              aria-controls={showAddForm ? addFormId : undefined}
            >
              {showAddForm ? tCommonActions('hide') : tCommonActions('add')}
            </Button>
          )}
        </DsLayoutInline>
      </DsLayoutInset>

      {canEdit && showAddForm && (
        <DsSectionCard
          id={addFormId}
          padding="sm"
          appearance="muted"
          role="group"
          aria-label={tCommon('entities.credits')}
        >
          <DsLayoutStack gap="xs">
            <DsLayoutInline gap="xs">
              <TextInput
                grow
                size="xs"
                aria-label={t('fields.newGroupName')}
                placeholder={t('fields.newGroupName')}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleCreateGroup();
                  }
                }}
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
            </DsLayoutInline>

            <Divider label={t('divider')} labelPosition="center" />

            <DsLayoutInline gap="xs">
              <SegmentedControl
                size="xs"
                aria-label={tCommon('entities.credit')}
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
              <div style={{ width: 120 }}>
                <TextInput
                  size="xs"
                  aria-label={tCommon('labels.role')}
                  placeholder={t('fields.rolePlaceholder')}
                  value={creditRole}
                  onChange={(e) => setCreditRole(e.currentTarget.value)}
                />
              </div>
              {groups.length > 0 && (
                <div style={{ width: 120 }}>
                  <Select
                    size="xs"
                    aria-label={t('fields.groupPlaceholder')}
                    placeholder={t('fields.groupPlaceholder')}
                    value={selectedGroupId ?? ''}
                    onChange={(val) => setSelectedGroupId(val || null)}
                    data={groupSelectData}
                    clearable
                  />
                </div>
              )}
            </DsLayoutInline>
            {searchType === 'name' ? (
              <DsLayoutInline gap="xs">
                <TextInput
                  grow
                  size="xs"
                  aria-label={tCommon('labels.name')}
                  placeholder={t('fields.creditNamePlaceholder')}
                  value={creditName}
                  onChange={(e) => setCreditName(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault();
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
                isLoading={searchFetching}
                debouncedSearch={debouncedSearch}
                onSelect={handleAddCredit}
                getItemId={(item) => item.id}
                getItemText={(item) => item.name ?? ''}
                emptyMessage={
                  searchType === 'member' ? tCommonMessages('noUsersFound') : t(`emptyResults.${searchType}`)
                }
                renderItem={(item) => (
                  <DsLayoutInline gap="sm">
                    <Avatar
                      src={searchType === 'artist' ? item.imageUrl : item.image}
                      size="xs"
                      shape="circle"
                      name={item.name}
                    />
                    <DsText size="xs">{item.name}</DsText>
                  </DsLayoutInline>
                )}
              />
            )}
          </DsLayoutStack>
        </DsSectionCard>
      )}

      {isLoading && creditOrder.length > 0 ? (
        // The persisted order is known: reserve each row so credits do not shift in.
        <DsLayoutStack gap="none">
          {creditOrder.map((item, index) =>
            item.type === 'group' ? (
              <CreditGroupHeaderSkeleton key={`skeleton-group-${index}`} />
            ) : (
              <CreditSkeleton key={`skeleton-credit-${index}`} />
            ),
          )}
        </DsLayoutStack>
      ) : isLoading ? (
        <PageLoader placement="flow" />
      ) : null}

      {showEmptyState && (
        <DsLayoutInset block="sm">
          <DsText size="xs" tone="secondary" align="center">
            {t('empty')}
          </DsText>
        </DsLayoutInset>
      )}

      {!isLoading && flatList.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={customCollisionDetection} onDragEnd={handleDragEnd}>
          <SortableContext items={flatList.map(getItemId)} strategy={verticalListSortingStrategy}>
            <DsLayoutStack gap="none">
              {flatList.map((item) =>
                item.type === 'group' ? (
                  <SortableCreditGroupHeader
                    key={`group-${item.group.id}`}
                    group={item.group}
                    canEdit={canEdit}
                    onEdit={(groupId, name) => {
                      return trackCreditMutation(() => updateGroup.mutateAsync({ groupId, name }));
                    }}
                    onDelete={(groupId) => {
                      void trackCreditMutation(() => deleteGroup.mutateAsync(groupId));
                    }}
                    isDeleting={deletingGroupId === item.group.id}
                  />
                ) : (
                  <SortableCreditRow
                    key={`credit-${item.credit.id}`}
                    credit={item.credit}
                    groupId={item.groupId}
                    canEdit={canEdit}
                    onRemove={(id) => {
                      void trackCreditMutation(() => removeCredit.mutateAsync(id));
                    }}
                    onEditRole={handleEditRole}
                    isRemoving={removingId === item.credit.id}
                    isUpdating={updatingRoleId === item.credit.id}
                  />
                ),
              )}

              {/* Ungrouped drop zone - shown when there are groups */}
              {groups.length > 0 && <UngroupedDropZone label={t('ungroupedDrop')} />}
            </DsLayoutStack>
          </SortableContext>
        </DndContext>
      )}
    </SectionCard>
  );
}
