import type {
  CreditOrderItem,
  FlatDisplayItem,
  WorkCreditGroupWithCredits,
  WorkCreditWithDetails,
} from '@/lib/types/work/credit';

export function getItemId(item: FlatDisplayItem): string {
  return item.type === 'group' ? `group-${item.group.id}` : `credit-${item.credit.id}`;
}

function getDefaultOrder(groups: WorkCreditGroupWithCredits[], ungrouped: WorkCreditWithDetails[]): CreditOrderItem[] {
  const result: CreditOrderItem[] = [];

  for (const group of groups) {
    result.push({ type: 'group', id: group.id });
    for (const c of group.credits) {
      result.push({
        type: 'credit',
        id: c.id,
        creditType: c.artist ? 'artist' : 'member',
      });
    }
  }

  for (const c of ungrouped) {
    result.push({
      type: 'credit',
      id: c.id,
      creditType: c.artist ? 'artist' : 'member',
    });
  }

  return result;
}

function buildFlatListFromOrder(
  order: CreditOrderItem[],
  groups: WorkCreditGroupWithCredits[],
  ungrouped: WorkCreditWithDetails[],
): FlatDisplayItem[] {
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  const creditMap = new Map<string, { credit: WorkCreditWithDetails; groupId: string | null }>();
  for (const group of groups) {
    for (const c of group.credits) {
      creditMap.set(c.id, { credit: c, groupId: group.id });
    }
  }
  for (const c of ungrouped) {
    creditMap.set(c.id, { credit: c, groupId: null });
  }

  const result: FlatDisplayItem[] = [];
  const usedIds = new Set<string>();

  for (const item of order) {
    if (item.type === 'group') {
      const group = groupMap.get(item.id);
      if (group) {
        result.push({ type: 'group', group });
        usedIds.add(`group-${item.id}`);
      }
    } else {
      const data = creditMap.get(item.id);
      if (data) {
        result.push({
          type: 'credit',
          credit: data.credit,
          groupId: data.groupId,
        });
        usedIds.add(`credit-${item.id}`);
      }
    }
  }

  // Add any new items not in order
  for (const group of groups) {
    if (!usedIds.has(`group-${group.id}`)) {
      result.push({ type: 'group', group });
      for (const c of group.credits) {
        if (!usedIds.has(`credit-${c.id}`)) {
          result.push({ type: 'credit', credit: c, groupId: group.id });
        }
      }
    } else {
      for (const c of group.credits) {
        if (!usedIds.has(`credit-${c.id}`)) {
          const groupIndex = result.findIndex((item) => item.type === 'group' && item.group.id === group.id);
          if (groupIndex !== -1) {
            let insertIndex = groupIndex + 1;
            while (
              insertIndex < result.length &&
              result[insertIndex].type === 'credit' &&
              (result[insertIndex] as { groupId: string | null }).groupId === group.id
            ) {
              insertIndex++;
            }
            result.splice(insertIndex, 0, {
              type: 'credit',
              credit: c,
              groupId: group.id,
            });
          }
        }
      }
    }
  }

  for (const c of ungrouped) {
    if (!usedIds.has(`credit-${c.id}`)) {
      result.push({ type: 'credit', credit: c, groupId: null });
    }
  }

  return result;
}

export function buildFlatList(
  order: CreditOrderItem[],
  groups: WorkCreditGroupWithCredits[],
  ungrouped: WorkCreditWithDetails[],
): FlatDisplayItem[] {
  if (order.length === 0) {
    const defaultOrder = getDefaultOrder(groups, ungrouped);
    return buildFlatListFromOrder(defaultOrder, groups, ungrouped);
  }

  return buildFlatListFromOrder(order, groups, ungrouped);
}

export function flatListToOrder(flatList: FlatDisplayItem[]): CreditOrderItem[] {
  return flatList.map((item) =>
    item.type === 'group'
      ? { type: 'group' as const, id: item.group.id }
      : {
          type: 'credit' as const,
          id: item.credit.id,
          creditType: (item.credit.artist ? 'artist' : 'member') as 'artist' | 'member',
        },
  );
}

export type CreditDragData =
  { type: 'group'; groupId: string } | { type: 'credit'; groupId: string | null; creditId: string };

export type CreditDropData =
  | { type: 'group'; groupId: string }
  | { type: 'credit'; groupId: string | null }
  | { type: 'ungrouped'; groupId: null };

export interface CreditDropPlan {
  order?: CreditOrderItem[];
  groupChange?: { creditId: string; groupId: string | null };
}

export function planCreditDrop({
  flatList,
  activeId,
  overId,
  activeData,
  overData,
}: {
  flatList: FlatDisplayItem[];
  activeId: string | number;
  overId: string | number;
  activeData?: CreditDragData;
  overData?: CreditDropData;
}): CreditDropPlan | null {
  if (!activeData || activeId === overId) {
    return null;
  }

  const activeIndex = flatList.findIndex((item) => getItemId(item) === activeId);
  const overIndex = flatList.findIndex((item) => getItemId(item) === overId);
  if (activeIndex < 0 || (overIndex < 0 && overData?.type !== 'ungrouped')) {
    return null;
  }

  return activeData.type === 'group'
    ? planGroupDrop(flatList, activeIndex, overIndex, activeData.groupId)
    : planSingleCreditDrop(flatList, activeIndex, overIndex, activeData, overData);
}

function planGroupDrop(
  flatList: FlatDisplayItem[],
  activeIndex: number,
  overIndex: number,
  groupId: string,
): CreditDropPlan | null {
  const itemsToMove = flatList.slice(activeIndex, findGroupEnd(flatList, activeIndex, groupId));
  if (itemsToMove[0]?.type !== 'group') {
    return null;
  }

  const remaining = flatList.filter((item) => !itemsToMove.includes(item));
  const overItem = flatList[overIndex];
  const targetIndex = overItem ? remaining.findIndex((item) => getItemId(item) === getItemId(overItem)) : -1;
  const insertIndex = targetIndex < 0 ? remaining.length : activeIndex < overIndex ? targetIndex + 1 : targetIndex;
  const reordered = [...remaining.slice(0, insertIndex), ...itemsToMove, ...remaining.slice(insertIndex)];
  return { order: flatListToOrder(reordered) };
}

function planSingleCreditDrop(
  flatList: FlatDisplayItem[],
  activeIndex: number,
  overIndex: number,
  activeData: Extract<CreditDragData, { type: 'credit' }>,
  overData?: CreditDropData,
): CreditDropPlan | null {
  if (!overData) {
    return null;
  }

  const targetGroupId = overData.groupId;
  const groupChanged = targetGroupId !== activeData.groupId;
  const groupChange = groupChanged ? { creditId: activeData.creditId, groupId: targetGroupId } : undefined;

  if (overData.type === 'credit') {
    return { order: flatListToOrder(moveItem(flatList, activeIndex, overIndex)), groupChange };
  }
  if (!groupChanged) {
    return null;
  }
  if (overData.type === 'ungrouped') {
    return { order: flatListToOrder(moveItem(flatList, activeIndex, flatList.length - 1)), groupChange };
  }
  if (overData.type !== 'group') {
    return groupChange ? { groupChange } : null;
  }

  const targetGroup = overData.groupId;
  const groupIndex = flatList.findIndex((item) => item.type === 'group' && item.group.id === targetGroup);
  if (groupIndex < 0) {
    return groupChange ? { groupChange } : null;
  }
  const insertIndex = findGroupEnd(flatList, groupIndex, targetGroup);
  return {
    order: flatListToOrder(moveItem(flatList, activeIndex, activeIndex < insertIndex ? insertIndex - 1 : insertIndex)),
    groupChange,
  };
}

function findGroupEnd(flatList: FlatDisplayItem[], groupIndex: number, groupId: string) {
  let index = groupIndex + 1;
  while (index < flatList.length) {
    const item = flatList[index];
    if (item.type !== 'credit' || item.groupId !== groupId) {
      break;
    }
    index++;
  }
  return index;
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}
