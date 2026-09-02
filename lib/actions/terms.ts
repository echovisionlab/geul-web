'use server';

import { isConnectErrorCode } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { createCommittedMutationRevalidator } from '@/lib/actions/revalidate-after-commit';
import { createTermsClient } from '@/lib/api/server-client';

const revalidateTermsAfterCommit = createCommittedMutationRevalidator('terms-actions', 'terms');

export async function createTermsVersionAction(): Promise<{
  data?: { id: string };
  error?: string;
}> {
  try {
    const client = await createTermsClient();
    const result = await client.createTermsVersion({});
    revalidatePath('/admin/terms');
    return { data: { id: result.id } };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create version' };
  }
}

export async function deleteTermsVersionAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createTermsClient();
    await client.deleteTerms({ id });
    revalidateTermsAfterCommit('/admin/terms');
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

export async function scheduleTermsAction(
  id: string,
  effectiveFrom: Date,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createTermsClient();
    await client.scheduleTerms({
      id,
      effectiveFrom: timestampFromDate(effectiveFrom),
    });
    revalidatePath('/admin/terms');
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

export async function cancelTermsScheduleAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createTermsClient();
    await client.cancelTermsSchedule({ id });
    revalidatePath('/admin/terms');
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

export async function activateTermsNowAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createTermsClient();
    await client.activateTermsNow({ id });
    revalidatePath('/admin/terms');
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

export async function regenerateTermsHtmlAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createTermsClient();
    const current = await client.getTermsVersion({ id });
    if (current.snapshotDigest.trim() === '') {
      return { error: 'Terms snapshot digest is unavailable' };
    }
    await client.regenerateTermsDerivedContent({
      id,
      expectedSnapshotDigest: current.snapshotDigest,
    });
    revalidatePath('/admin/terms');
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to regenerate HTML' };
  }
}
