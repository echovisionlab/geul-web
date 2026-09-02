/** Client-side diagnostics stay local to the browser. */

interface LogData {
  [key: string]: unknown;
}

function hasLogErrorProperties(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function copyOptionalString(
  target: Record<string, string | number>,
  source: Record<string, unknown>,
  key: 'stack' | 'digest',
) {
  const value = source[key];
  if (typeof value === 'string' && value) {
    target[key] = value;
  }
}

export function serializeClientLogError(error: unknown): Record<string, string | number> {
  const details: Record<string, string | number> =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
        }
      : {
          name: typeof error,
          message: String(error),
        };

  if (hasLogErrorProperties(error)) {
    const name = error.name;
    const message = error.message;
    const code = error.code;

    if (typeof name === 'string' && name) {
      details.name = name;
    }
    if (typeof message === 'string' && message) {
      details.message = message;
    }
    if (typeof code === 'string' || typeof code === 'number') {
      details.code = code;
    }
    copyOptionalString(details, error, 'stack');
    copyOptionalString(details, error, 'digest');
  }

  return details;
}

export function createClientLogger(source: string) {
  const writeLocal = (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: LogData) => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }
    // Browser diagnostics intentionally stay in the local developer console.
    const localConsole = globalThis.console;
    const method =
      level === 'debug'
        ? localConsole.debug
        : level === 'info'
          ? localConsole.info
          : level === 'warn'
            ? localConsole.warn
            : localConsole.error;
    method(`[${source}] ${message}`, data ?? {});
  };

  return {
    debug: (message: string, data?: LogData) => {
      writeLocal('debug', message, data);
    },
    info: (message: string, data?: LogData) => {
      writeLocal('info', message, data);
    },
    warn: (message: string, data?: LogData) => {
      writeLocal('warn', message, data);
    },
    error: (message: string, data?: LogData) => {
      writeLocal('error', message, data);
    },
  };
}
