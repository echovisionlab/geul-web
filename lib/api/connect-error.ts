import { Code, ConnectError } from '@connectrpc/connect';

export function connectErrorCode(error: unknown): Code | undefined {
  return error instanceof ConnectError ? error.code : undefined;
}

export function isConnectError(error: unknown): error is ConnectError {
  return error instanceof ConnectError;
}

export function isConnectErrorCode(error: unknown, ...codes: readonly Code[]): error is ConnectError {
  const code = connectErrorCode(error);
  return code !== undefined && codes.includes(code);
}

export function isAuthenticationConnectError(error: unknown): error is ConnectError {
  if (!isConnectError(error)) {
    return false;
  }
  if (error.code === Code.Unauthenticated) {
    return true;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes('unauthenticated') ||
    message.includes('authentication') ||
    message.includes('login') ||
    message.includes('access credentials are invalid')
  );
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
