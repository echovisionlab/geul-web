'use server';

import { isConnectErrorCode } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { createCommittedMutationRevalidator } from '@/lib/actions/revalidate-after-commit';
import { createPrivacyClient } from '@/lib/api/server-client';

const revalidatePrivacyAfterCommit = createCommittedMutationRevalidator('privacy-actions', 'privacy');

// ============================================
// Mutation actions for Privacy domain
// ============================================

export async function createPrivacyVersionAction(): Promise<{
  data?: { id: string };
  error?: string;
}> {
  try {
    const client = await createPrivacyClient();
    const result = await client.createPrivacyVersion({});
    revalidatePath('/admin/privacy');
    return { data: { id: result.id } };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create version' };
  }
}

export async function deletePrivacyVersionAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPrivacyClient();
    await client.deletePrivacy({ id });
    revalidatePrivacyAfterCommit('/admin/privacy');
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.FailedPrecondition)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete version' };
  }
}

export async function schedulePrivacyAction(
  id: string,
  effectiveFrom: Date,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPrivacyClient();
    await client.schedulePrivacy({
      id,
      effectiveFrom: timestampFromDate(effectiveFrom),
    });
    revalidatePath('/admin/privacy');
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.FailedPrecondition)) {
      return { error: err.message };
    }
    if (isConnectErrorCode(err, Code.InvalidArgument)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to schedule' };
  }
}

export async function cancelPrivacyScheduleAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPrivacyClient();
    await client.cancelPrivacySchedule({ id });
    revalidatePath('/admin/privacy');
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.FailedPrecondition)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to cancel schedule' };
  }
}

export async function activatePrivacyNowAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPrivacyClient();
    await client.activatePrivacyNow({ id });
    revalidatePath('/admin/privacy');
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.FailedPrecondition)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to activate' };
  }
}

export async function regeneratePrivacyHtmlAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createPrivacyClient();
    const current = await client.getPrivacyVersion({ id });
    if (current.snapshotDigest.trim() === '') {
      return { error: 'Privacy snapshot digest is unavailable' };
    }
    await client.regeneratePrivacyDerivedContent({
      id,
      expectedSnapshotDigest: current.snapshotDigest,
    });
    revalidatePath('/admin/privacy');
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to regenerate HTML' };
  }
}
