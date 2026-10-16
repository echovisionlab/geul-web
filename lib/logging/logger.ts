import { Code } from '@connectrpc/connect';
import { connectErrorCode } from '@/lib/api/connect-error';
import { normalizeLogAttributes, stableErrorType } from '@echovisionlab/geul-telemetry/redaction';
import { dispatchLogEntry } from './log-sink';
import { failureCause } from './failure-cause';
import type { LogEntry, LogLevel } from './types';

interface LogOptions {
  data?: Record<string, unknown> & {
    action?: never;
    event?: never;
    outcome?: never;
  };
  error?: unknown;
  privateValues?: readonly unknown[];
}

function buildAttributes(module: string, options?: LogOptions): Record<string, unknown> {
  const attributes: Record<string, unknown> = normalizeLogAttributes(options?.data);
  if (options && 'error' in options) {
    attributes.error_type = stableErrorType(options.error);
  }
  // Browser reporting keeps its bounded classification-only contract.
  if (typeof window === 'undefined' && options) {
    const error = options.error ?? options.data?.error ?? options.data?.err;
    if (error !== undefined) {
      attributes.failure_cause = failureCause(error, options.privateValues);
    }
  }
  return { ...attributes, module };
}

export function createLogger(module: string) {
  const log = async (level: LogLevel, message: string, options?: LogOptions) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      attributes: buildAttributes(module, options),
    };
    await dispatchLogEntry(entry);
  };

  return {
    debug: (message: string, options?: LogOptions) => log('debug', message, options),
    info: (message: string, options?: LogOptions) => log('info', message, options),
    warn: (message: string, options?: LogOptions) => log('warn', message, options),
    error: (message: string, options?: LogOptions) => log('error', message, options),
    catchError: (logContext: string) => (error: unknown) => {
      void log('error', `${logContext} failed`, { error });
    },
  };
}

const expectedCodes = new Set([
  Code.Canceled,
  Code.InvalidArgument,
  Code.OutOfRange,
  Code.Unauthenticated,
  Code.PermissionDenied,
  Code.NotFound,
  Code.AlreadyExists,
  Code.Aborted,
  Code.FailedPrecondition,
  Code.ResourceExhausted,
]);

/** Log before a server boundary maps an error to a fallback or client result. */
export function logServerFailure(
  module: string,
  operation: string,
  error: unknown,
  privateValues?: readonly unknown[],
  data?: LogOptions['data'],
): void {
  const logger = createLogger(module);
  const code = connectErrorCode(error);
  const expectedHttpFallback =
    error !== null &&
    typeof error === 'object' &&
    'digest' in error &&
    typeof error.digest === 'string' &&
    /^NEXT_HTTP_ERROR_FALLBACK;(401|403|404)$/.test(error.digest);
  const level = expectedHttpFallback || (code !== undefined && expectedCodes.has(code)) ? 'warn' : 'error';
  void logger[level](`${operation} failed`, {
    error,
    privateValues,
    data: { ...data, operation, ...(code === undefined ? {} : { rpc_code: code }) },
  });
}
