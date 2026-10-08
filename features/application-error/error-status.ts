import { preservedQueryErrorStatus } from '@/lib/api/query-error';
import { Code } from '@connectrpc/connect';
import { connectErrorCode } from '@/lib/api/connect-error';
import messages from '@/lib/i18n/error-page-messages.json';
import { DEFAULT_LOCALE, type SupportedLocale } from '@/lib/i18n/locale';

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
  const rpcCode = connectErrorCode(error);
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

export function getErrorPageContent(status: number, locale: SupportedLocale = DEFAULT_LOCALE) {
  const catalogue = messages[locale];
  const title = catalogue.titles[String(status) as keyof typeof catalogue.titles] ?? catalogue.titles['500'];
  return { code: String(status), title, ...catalogue.actions };
}

export function canRetryErrorStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}
