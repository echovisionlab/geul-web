'use server';

import { isConnectError } from '@/lib/api/connect-error';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { createAccountClient, createPublicAccountClient } from '@/lib/api/server-client';

export interface ActionResult {
  success: boolean;
  message: string;
  scheduledAt?: Date;
  error?: 'reauth_required';
}

/**
 * Request account deletion for the current user.
 * Sends a confirmation email to the user.
 */
export async function requestAccountDeletionAction(): Promise<ActionResult> {
  try {
    const client = await createAccountClient();
    const response = await client.requestAccountDeletion({});

    return {
      success: response.success,
      message: response.message,
    };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.FailedPrecondition && err.message.toLowerCase().includes('reauthenticate')) {
        return { success: false, message: err.message, error: 'reauth_required' };
      }
      return { success: false, message: err.message };
    }
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to request account deletion',
    };
  }
}

/**
 * Confirm account deletion via token from email.
 * Schedules the account for permanent deletion after 30 days.
 */
export async function confirmAccountDeletionAction(token: string): Promise<ActionResult> {
  try {
    const client = createPublicAccountClient();
    const response = await client.confirmAccountDeletion({ token });

    return {
      success: response.success,
      message: response.message,
      scheduledAt: response.scheduledAt ? timestampDate(response.scheduledAt) : undefined,
    };
  } catch (err) {
    if (isConnectError(err)) {
      return { success: false, message: err.message };
    }
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to confirm account deletion',
    };
  }
}

/**
 * Cancel a pending account deletion via token from email.
 * Reactivates the account immediately.
 */
export async function cancelAccountDeletionAction(token: string): Promise<ActionResult> {
  try {
    const client = createPublicAccountClient();
    const response = await client.cancelAccountDeletion({ token });

    return {
      success: response.success,
      message: response.message,
    };
  } catch (err) {
    if (isConnectError(err)) {
      return { success: false, message: err.message };
    }
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to cancel account deletion',
    };
  }
}

export interface RecoveryFormState {
  success: boolean;
  message: string;
  submitted: boolean;
}

/**
 * Form action for requesting account recovery.
 * Used with useActionState for progressive enhancement.
 */
export async function requestAccountRecoveryFormAction(
  _prevState: RecoveryFormState,
  formData: FormData,
): Promise<RecoveryFormState> {
  const email = formData.get('email') as string;

  if (!email?.trim()) {
    return { success: false, message: 'Email is required', submitted: false };
  }

  try {
    const client = createPublicAccountClient();
    const response = await client.requestAccountRecovery({ email: email.trim() });

    return {
      success: response.success,
      message: response.message,
      submitted: true,
    };
  } catch (err) {
    if (isConnectError(err)) {
      return { success: false, message: err.message, submitted: true };
    }
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to request account recovery',
      submitted: true,
    };
  }
}

/**
 * Confirm account recovery via token from email.
 * Reactivates the account and cancels the pending deletion.
 */
export async function confirmAccountRecoveryAction(token: string): Promise<ActionResult> {
  try {
    const client = createPublicAccountClient();
    const response = await client.confirmAccountRecovery({ token });

    return {
      success: response.success,
      message: response.message,
    };
  } catch (err) {
    if (isConnectError(err)) {
      return { success: false, message: err.message };
    }
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to confirm account recovery',
    };
  }
}
