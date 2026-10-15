import { preservedQueryErrorStatus } from '@/lib/api/query-error';
import { Code } from '@connectrpc/connect';
import { connectErrorShapeCode } from '@/lib/api/connect-error-shape';

const RPC_STATUS: Partial<Record<Code, number>> = {
  [Code.InvalidArgument]: 400,
  [Code.Unauthenticated]: 401,
  [Code.PermissionDenied]: 403,
  [Code.NotFound]: 404,
  [Code.AlreadyExists]: 409,
  [Code.Aborted]: 409,
  [Code.FailedPrecondition]: 422,
  [Code.OutOfRange]: 400,
  [Code.ResourceExhausted]: 429,
  [Code.Unimplemented]: 501,
  [Code.Unavailable]: 503,
  [Code.DeadlineExceeded]: 504,
};

export function resolveErrorStatus(error: unknown): number {
  const rpcCode = connectErrorShapeCode(error);
  if (rpcCode !== undefined) {
    return RPC_STATUS[rpcCode] ?? 500;
  }
  if (error && typeof error === 'object') {
    const httpError = error as { status?: unknown; statusCode?: unknown };
    for (const candidate of [httpError.status, httpError.statusCode]) {
      if (typeof candidate === 'number' && Number.isInteger(candidate) && candidate >= 400 && candidate <= 599) {
        return candidate;
      }
    }
  }
  return preservedQueryErrorStatus(error) ?? 500;
}

/** One locale of `lib/i18n/error-page-messages.json`; also the `errorPage` client message namespace. */
export interface ErrorPageMessages {
  titles: Readonly<Record<string, string>> & { readonly '500': string };
  actions: { readonly goHome: string; readonly tryAgain: string; readonly login: string };
}

export function getErrorPageContent(status: number, messages: ErrorPageMessages) {
  const title = messages.titles[String(status)] ?? messages.titles['500'];
  return { code: String(status), title, ...messages.actions };
}

export function canRetryErrorStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}
