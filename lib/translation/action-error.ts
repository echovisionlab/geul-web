import { isConnectError } from '@/lib/api/connect-error';
import { Code } from '@connectrpc/connect';

export function getTranslationActionErrorMessage(error: unknown, fallback: string): string {
  if (isConnectError(error)) {
    if (error.code === Code.Unauthenticated) {
      return 'Unauthorized';
    }
    if (error.code === Code.PermissionDenied) {
      return 'Forbidden';
    }
  }

  return fallback;
}
