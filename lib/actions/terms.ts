'use server';

import { revalidatePath } from 'next/cache';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import type { ActionResult } from '@/lib/actions/action-result';
import { createCommittedMutationRevalidator } from '@/lib/actions/revalidate-after-commit';
import { runAction } from '@/lib/actions/run-action';
import { createTermsClient } from '@/lib/api/server-client';

const revalidateTermsAfterCommit = createCommittedMutationRevalidator('terms-actions', 'terms');

export async function createTermsVersionAction(): Promise<ActionResult<{ data: { id: string } }>> {
  return runAction(
    'terms-actions',
    'createTermsVersionAction',
    async () => {
      const client = await createTermsClient();
      const result = await client.createTermsVersion({});
      revalidatePath('/admin/terms');
      return { data: { id: result.id } };
    },
    { fallback: 'Failed to create version' },
  );
}

export async function deleteTermsVersionAction(
  id: string,
  expectedRevision: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'terms-actions',
    'deleteTermsVersionAction',
    async () => {
      const client = await createTermsClient();
      await client.deleteTerms({ id, expectedRevision });
      revalidateTermsAfterCommit('/admin/terms');
      return { success: true as const };
    },
    { fallback: 'Failed to delete version' },
  );
}

export async function scheduleTermsAction(
  id: string,
  effectiveFrom: Date,
  expectedRevision: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'terms-actions',
    'scheduleTermsAction',
    async () => {
      const client = await createTermsClient();
      await client.scheduleTerms({
        id,
        effectiveFrom: timestampFromDate(effectiveFrom),
        expectedRevision,
      });
      revalidatePath('/admin/terms');
      return { success: true as const };
    },
    { fallback: 'Failed to schedule' },
  );
}

export async function cancelTermsScheduleAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'terms-actions',
    'cancelTermsScheduleAction',
    async () => {
      const client = await createTermsClient();
      await client.cancelTermsSchedule({ id });
      revalidatePath('/admin/terms');
      return { success: true as const };
    },
    { fallback: 'Failed to cancel schedule' },
  );
}

export async function activateTermsNowAction(
  id: string,
  expectedRevision: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'terms-actions',
    'activateTermsNowAction',
    async () => {
      const client = await createTermsClient();
      await client.activateTermsNow({ id, expectedRevision });
      revalidatePath('/admin/terms');
      return { success: true as const };
    },
    { fallback: 'Failed to activate' },
  );
}

export async function regenerateTermsHtmlAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'terms-actions',
    'regenerateTermsHtmlAction',
    async () => {
      const client = await createTermsClient();
      const current = await client.getTermsVersion({ id });
      if (current.snapshotDigest.trim() === '') {
        throw new Error('Terms snapshot digest is unavailable');
      }
      await client.regenerateTermsDerivedContent({
        id,
        expectedSnapshotDigest: current.snapshotDigest,
      });
      revalidatePath('/admin/terms');
      return { success: true as const };
    },
    { fallback: 'Failed to regenerate HTML' },
  );
}
