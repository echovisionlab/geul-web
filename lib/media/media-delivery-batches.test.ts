import { describe, expect, it, vi } from 'vitest';
import {
  createPairedMediaDeliveryBatches,
  fetchMediaDeliveryBatches,
  mergeRecordBatches,
  uniqueMediaIdsInOrder,
} from './media-delivery-batches';

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `file-${index + 1}`);
}

describe('media delivery batches', () => {
  it.each([
    [100, 1],
    [101, 2],
    [201, 3],
  ])('uses the API maximum for %i unique IDs in %i calls', async (count, expectedCalls) => {
    const fetchBatch = vi.fn(async (batch: string[]) => batch);

    const responses = await fetchMediaDeliveryBatches(ids(count), fetchBatch);

    expect(fetchBatch).toHaveBeenCalledTimes(expectedCalls);
    expect(fetchBatch.mock.calls.every(([batch]) => batch.length <= 100)).toBe(true);
    expect(responses.flat()).toEqual(ids(count));
  });

  it('deduplicates IDs by first occurrence and preserves stable order', () => {
    expect(uniqueMediaIdsInOrder([' file-b ', 'file-a', 'file-b', '', 'file-c', 'file-a'])).toEqual([
      'file-b',
      'file-a',
      'file-c',
    ]);
  });

  it('pairs independently bounded file and track groups without N+1 calls', () => {
    const batches = createPairedMediaDeliveryBatches(
      [...ids(201), 'file-1'],
      [...ids(101).map((id) => id.replace('file', 'track')), 'track-1'],
    );

    expect(batches).toHaveLength(3);
    expect(batches.map((batch) => batch.fileIds.length)).toEqual([100, 100, 1]);
    expect(batches.map((batch) => batch.trackIds.length)).toEqual([100, 1, 0]);
  });

  it('merges batch records without changing their values', () => {
    expect(mergeRecordBatches([{ 'file-a': 1 }, undefined, { 'file-b': 2 }])).toEqual({
      'file-a': 1,
      'file-b': 2,
    });
  });
});
