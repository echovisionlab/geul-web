export const MEDIA_DELIVERY_BATCH_SIZE = 100;

export function uniqueMediaIdsInOrder(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function createMediaDeliveryBatches<T>(values: readonly T[]): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < values.length; index += MEDIA_DELIVERY_BATCH_SIZE) {
    batches.push(values.slice(index, index + MEDIA_DELIVERY_BATCH_SIZE));
  }
  return batches;
}

export async function fetchMediaDeliveryBatches<T, TResult>(
  values: readonly T[],
  fetchBatch: (batch: T[]) => Promise<TResult>,
): Promise<TResult[]> {
  return Promise.all(createMediaDeliveryBatches(values).map((batch) => fetchBatch(batch)));
}

export function createPairedMediaDeliveryBatches(
  fileIds: readonly string[],
  trackIds: readonly string[],
): Array<{ fileIds: string[]; trackIds: string[] }> {
  const fileBatches = createMediaDeliveryBatches(uniqueMediaIdsInOrder(fileIds));
  const trackBatches = createMediaDeliveryBatches(uniqueMediaIdsInOrder(trackIds));
  const batchCount = Math.max(fileBatches.length, trackBatches.length);

  return Array.from({ length: batchCount }, (_, index) => ({
    fileIds: fileBatches[index] ?? [],
    trackIds: trackBatches[index] ?? [],
  }));
}

export function mergeRecordBatches<T>(records: readonly (Record<string, T> | undefined)[]): Record<string, T> {
  return Object.assign({}, ...records.filter((record): record is Record<string, T> => Boolean(record)));
}
