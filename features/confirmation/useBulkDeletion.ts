'use client';

import { useRef, useState } from 'react';

export interface BulkDeletionResult {
  successfulIds: string[];
  errors: string[];
}

/** Preserve successful deletions even when another request rejects or reports a domain error. */
export async function deleteSelectedItems(
  ids: readonly string[],
  deleteAction: (id: string) => Promise<{ error?: string }>,
  fallbackError: string,
): Promise<BulkDeletionResult> {
  const results = await Promise.allSettled(ids.map((id) => Promise.resolve().then(() => deleteAction(id))));
  const successfulIds: string[] = [];
  const errors: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      errors.push(result.reason instanceof Error && result.reason.message ? result.reason.message : fallbackError);
    } else if (result.value.error) {
      errors.push(result.value.error);
    } else {
      successfulIds.push(ids[index]);
    }
  });
  return { successfulIds, errors };
}

export function useBulkDeletion() {
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  const execute = async (
    ids: readonly string[],
    deleteAction: (id: string) => Promise<{ error?: string }>,
    fallbackError: string,
    onResult: (result: BulkDeletionResult) => void | Promise<void>,
  ) => {
    if (pending.current) {
      return;
    }
    pending.current = true;
    setLoading(true);
    try {
      await onResult(await deleteSelectedItems(ids, deleteAction, fallbackError));
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };
  return { loading, execute };
}
