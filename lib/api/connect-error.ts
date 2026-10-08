import { Code, ConnectError } from '@connectrpc/connect';

export function connectErrorCode(error: unknown): Code | undefined {
  return error instanceof ConnectError ? error.code : undefined;
}

export function connectActionErrorCode<TFallbackCode extends string>(
  error: unknown,
  fallbackCode: TFallbackCode,
): Code | TFallbackCode {
  const code = connectErrorCode(error);
  return code ?? fallbackCode;
}

export function isConnectError(error: unknown): error is ConnectError {
  return error instanceof ConnectError;
}

export function isConnectErrorCode(error: unknown, ...codes: readonly Code[]): error is ConnectError {
  const code = connectErrorCode(error);
  return code !== undefined && codes.includes(code);
}

export function isAuthenticationConnectError(error: unknown): error is ConnectError {
  return isConnectErrorCode(error, Code.Unauthenticated);
}

type ConnectErrorMessage = string | ((error: ConnectError) => string);

export function connectActionErrorMessage(
  error: unknown,
  fallback: string,
  messages: Readonly<Partial<Record<Code, ConnectErrorMessage>>>,
): string {
  if (!isConnectError(error)) {
    return fallback;
  }
  const message = messages[error.code];
  if (message === undefined) {
    return fallback;
  }
  return typeof message === 'function' ? message(error) : message;
}
