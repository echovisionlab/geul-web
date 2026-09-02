'use server';

import { isConnectError } from '@/lib/api/connect-error';
import { Code, ConnectError } from '@connectrpc/connect';
import { createAccountClient } from '@/lib/api/server-client';

export interface ActionResult {
  success: boolean;
  message: string;
  error?: 'reauth_required';
}

function connectActionFailure(err: ConnectError): ActionResult {
  if (err.code === Code.FailedPrecondition && err.message.toLowerCase().includes('reauthenticate')) {
    return { success: false, message: err.message, error: 'reauth_required' };
  }
  return { success: false, message: err.message };
}

/**
 * Preflight an email-change verification-code request for the current user.
 * Kratos owns the actual verification email and token.
 */
export async function requestEmailChangeAction(newEmail: string): Promise<ActionResult> {
  try {
    const client = await createAccountClient();
    const response = await client.requestEmailChange({ newEmail });

    return {
      success: response.success,
      message: response.message,
    };
  } catch (err) {
    if (isConnectError(err)) {
      return connectActionFailure(err);
    }
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to request email change',
    };
  }
}
