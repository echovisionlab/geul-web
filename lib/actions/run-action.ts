import 'server-only';

import { Code, ConnectError } from '@connectrpc/connect';
import { unstable_rethrow } from 'next/navigation';
import { connectErrorCode } from '@/lib/api/connect-error';
import { logServerFailure } from '@/lib/logging/logger';
import { actionFailure, actionSuccess, type ActionErrorCode, type ActionResult } from './action-result';

const SERVER_FAULT_CODES: ReadonlySet<Code> = new Set([
  Code.Internal,
  Code.Unknown,
  Code.DataLoss,
  Code.Unavailable,
  Code.DeadlineExceeded,
  Code.Canceled,
]);

type ActionFailureMessage = string | ((error: ConnectError) => string);

export interface ActionFailurePolicy {
  /** Shown when neither a message for the code nor the error itself says more. */
  fallback: string;
  /** Code for failures that are not Connect errors. */
  code?: ActionErrorCode;
  /** Wording for specific Connect codes, replacing the server's message. */
  messages?: Readonly<Partial<Record<Code, ActionFailureMessage>>>;
  /** Values the failure log must redact, such as email addresses or tokens. */
  privateValues?: readonly unknown[];
}

/**
 * The one failure path for Server Action mutations: logs the failure, keeps the Connect code as the
 * result's errorCode and picks the message. A lost session needs nothing here: the server API
 * transport already ended it and Next re-renders the page.
 */
export async function runAction<TSuccessFields extends object>(
  scope: string,
  operation: string,
  run: () => Promise<TSuccessFields>,
  policy: ActionFailurePolicy,
): Promise<ActionResult<TSuccessFields>> {
  try {
    return actionSuccess(await run()) as ActionResult<TSuccessFields>;
  } catch (error) {
    // redirect() and notFound() inside run are navigation, not failures.
    unstable_rethrow(error);
    logServerFailure(scope, operation, error, policy.privateValues);
    return actionFailure(
      actionFailureMessage(error, policy),
      connectErrorCode(error) ?? policy.code ?? 'ACTION_FAILED',
    ) as ActionResult<TSuccessFields>;
  }
}

export function actionFailureMessage(
  error: unknown,
  policy: Pick<ActionFailurePolicy, 'fallback' | 'messages'>,
): string {
  if (error instanceof ConnectError) {
    const message = policy.messages?.[error.code];
    if (message !== undefined) {
      return typeof message === 'function' ? message(error) : message;
    }
    if (error.code === Code.Unauthenticated) {
      return 'Unauthorized';
    }
    // Server faults carry the underlying cause (SQL, upstream text); the log keeps it, the user
    // gets the action's own wording.
    if (SERVER_FAULT_CODES.has(error.code)) {
      return policy.fallback;
    }
    return error.rawMessage.trim() || policy.fallback;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return policy.fallback;
}
