'use server';

import { revalidatePath } from 'next/cache';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import type { ActionResult } from '@/lib/actions/action-result';
import { createCommittedMutationRevalidator } from '@/lib/actions/revalidate-after-commit';
import { runAction } from '@/lib/actions/run-action';
import { createPrivacyClient } from '@/lib/api/server-client';

const revalidatePrivacyAfterCommit = createCommittedMutationRevalidator('privacy-actions', 'privacy');

// ============================================
// Mutation actions for Privacy domain
// ============================================

export async function createPrivacyVersionAction(): Promise<ActionResult<{ data: { id: string } }>> {
  return runAction(
    'privacy-actions',
    'createPrivacyVersionAction',
    async () => {
      const client = await createPrivacyClient();
      const result = await client.createPrivacyVersion({});
      revalidatePath('/admin/privacy');
      return { data: { id: result.id } };
    },
    { fallback: 'Failed to create version' },
  );
}

export async function deletePrivacyVersionAction(
  id: string,
  expectedRevision: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'privacy-actions',
    'deletePrivacyVersionAction',
    async () => {
      const client = await createPrivacyClient();
      await client.deletePrivacy({ id, expectedRevision });
      revalidatePrivacyAfterCommit('/admin/privacy');
      return { success: true as const };
    },
    { fallback: 'Failed to delete version' },
  );
}

export async function schedulePrivacyAction(
  id: string,
  effectiveFrom: Date,
  expectedRevision: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'privacy-actions',
    'schedulePrivacyAction',
    async () => {
      const client = await createPrivacyClient();
      await client.schedulePrivacy({
        id,
        effectiveFrom: timestampFromDate(effectiveFrom),
        expectedRevision,
      });
      revalidatePath('/admin/privacy');
      return { success: true as const };
    },
    { fallback: 'Failed to schedule' },
  );
}

export async function cancelPrivacyScheduleAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'privacy-actions',
    'cancelPrivacyScheduleAction',
    async () => {
      const client = await createPrivacyClient();
      await client.cancelPrivacySchedule({ id });
      revalidatePath('/admin/privacy');
      return { success: true as const };
    },
    { fallback: 'Failed to cancel schedule' },
  );
}

export async function activatePrivacyNowAction(
  id: string,
  expectedRevision: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'privacy-actions',
    'activatePrivacyNowAction',
    async () => {
      const client = await createPrivacyClient();
      await client.activatePrivacyNow({ id, expectedRevision });
      revalidatePath('/admin/privacy');
      return { success: true as const };
    },
    { fallback: 'Failed to activate' },
  );
}

export async function regeneratePrivacyHtmlAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'privacy-actions',
    'regeneratePrivacyHtmlAction',
    async () => {
      const client = await createPrivacyClient();
      const current = await client.getPrivacyVersion({ id });
      if (current.snapshotDigest.trim() === '') {
        throw new Error('Privacy snapshot digest is unavailable');
      }
      await client.regeneratePrivacyDerivedContent({
        id,
        expectedSnapshotDigest: current.snapshotDigest,
      });
      revalidatePath('/admin/privacy');
      return { success: true as const };
    },
    { fallback: 'Failed to regenerate HTML' },
  );
}
