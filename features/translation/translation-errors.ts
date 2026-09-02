import { isConnectError } from '@/lib/api/connect-error';
import { Code } from '@connectrpc/connect';

export function isNotFoundTranslationError(error: unknown): boolean {
  if (isConnectError(error)) {
    return error.code === Code.NotFound;
  }
  return error instanceof Error && /not[\s_-]?found/i.test(error.message);
}
