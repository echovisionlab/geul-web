import { describe, expect, it } from 'vitest';
import type { FlatDisplayItem, WorkCreditGroup, WorkCreditWithDetails } from '@/lib/types/work/credit';
import { planCreditDrop } from './credit-order-utils';

const group = (id: string): WorkCreditGroup => ({ id, workId: 'work', name: id, sortOrder: 0 });
const credit = (id: string, groupId: string | null): WorkCreditWithDetails => ({
  id,
  groupId,
  name: id,
  creditRole: null,
  sortOrder: 0,
  artist: null,
  member: null,
});
const groupItem = (id: string): FlatDisplayItem => ({ type: 'group', group: group(id) });
const creditItem = (id: string, groupId: string | null): FlatDisplayItem => ({
  type: 'credit',
  credit: credit(id, groupId),
  groupId,
});

describe('planCreditDrop', () => {
  it('moves a whole group with its credits', () => {
    const flatList = [groupItem('a'), creditItem('a1', 'a'), groupItem('b'), creditItem('b1', 'b')];

    const plan = planCreditDrop({
      flatList,
      activeId: 'group-a',
      overId: 'credit-b1',
      activeData: { type: 'group', groupId: 'a' },
      overData: { type: 'credit', groupId: 'b' },
    });

    expect(plan?.order?.map((item) => item.id)).toEqual(['b', 'b1', 'a', 'a1']);
  });

  it('moves a credit to the end of a target group and plans the group mutation', () => {
    const flatList = [groupItem('a'), creditItem('a1', 'a'), creditItem('u1', null)];

    const plan = planCreditDrop({
      flatList,
      activeId: 'credit-u1',
      overId: 'group-a',
      activeData: { type: 'credit', creditId: 'u1', groupId: null },
      overData: { type: 'group', groupId: 'a' },
    });

    expect(plan?.order?.map((item) => item.id)).toEqual(['a', 'a1', 'u1']);
    expect(plan?.groupChange).toEqual({ creditId: 'u1', groupId: 'a' });
  });

  it('moves a grouped credit into the ungrouped tail', () => {
    const flatList = [groupItem('a'), creditItem('a1', 'a'), creditItem('u1', null)];

    const plan = planCreditDrop({
      flatList,
      activeId: 'credit-a1',
      overId: 'droppable-ungrouped',
      activeData: { type: 'credit', creditId: 'a1', groupId: 'a' },
      overData: { type: 'ungrouped', groupId: null },
    });

    expect(plan?.order?.map((item) => item.id)).toEqual(['a', 'u1', 'a1']);
    expect(plan?.groupChange).toEqual({ creditId: 'a1', groupId: null });
  });
});
