import { markQueryError } from './query-error';
import { toHttpErrorResult } from './http-error';

export type QueryResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

export type QueryValue<T> = T extends { ok: true; value: infer V } ? V : never;

class QueryFailureError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    markQueryError(this, status);
  }
}

/** Server Actions must serialize failure categories instead of throwing diagnostics across the boundary. */
export async function queryResult<T>(read: () => Promise<T>): Promise<QueryResult<T>> {
  try {
    return { ok: true, value: await read() };
  } catch (error) {
    if (error instanceof QueryFailureError) {
      return { ok: false, status: error.status, error: error.message };
    }
    return { ok: false, ...toHttpErrorResult(error, 'Failed to load data') };
  }
}

export function unwrapQueryResult<T>(result: QueryResult<T>): T {
  if (result.ok) {
    return result.value;
  }
  throw new QueryFailureError(result.error, result.status);
}
