import { normalizeLogAttributes, stableErrorType } from '@echovisionlab/geul-telemetry/redaction';
import { dispatchLogEntry } from './log-sink';
import type { LogEntry, LogLevel } from './types';

interface LogOptions {
  data?: Record<string, unknown> & {
    action?: never;
    event?: never;
    outcome?: never;
  };
  error?: unknown;
}

function buildAttributes(module: string, options?: LogOptions): Record<string, unknown> {
  const attributes: Record<string, unknown> = normalizeLogAttributes(options?.data);
  if (options && 'error' in options) {
    attributes.error_type = stableErrorType(options.error);
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
