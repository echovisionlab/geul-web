import { Code, ConnectError } from '@connectrpc/connect';
import { describe, expect, it } from 'vitest';
import {
  connectActionErrorMessage,
  connectErrorCode,
  isAuthenticationConnectError,
  isConnectError,
  isConnectErrorCode,
} from './connect-error';

describe('Connect error helpers', () => {
  it('centralizes ConnectError narrowing and multi-code matching', () => {
    const error = new ConnectError('missing', Code.NotFound);
    expect(isConnectError(error)).toBe(true);
    expect(connectErrorCode(error)).toBe(Code.NotFound);
    expect(isConnectErrorCode(error, Code.NotFound, Code.PermissionDenied)).toBe(true);
    expect(isAuthenticationConnectError(error)).toBe(false);
  });

  it('does not expose unexpected provider details', () => {
    const internal = new ConnectError('private database detail', Code.Internal);
    expect(connectActionErrorMessage(internal, 'Request failed', { [Code.NotFound]: 'Missing' })).toBe(
      'Request failed',
    );
  });

  it('allows explicit domain mappings for safe codes', () => {
    const denied = new ConnectError('raw permission detail', Code.PermissionDenied);
    expect(
      connectActionErrorMessage(denied, 'Request failed', {
        [Code.PermissionDenied]: 'No permission',
      }),
    ).toBe('No permission');
  });

  it('does not classify unrelated permission failures as authentication failures', () => {
    expect(isAuthenticationConnectError(new ConnectError('edit is forbidden', Code.PermissionDenied))).toBe(false);
    expect(isAuthenticationConnectError(new ConnectError('login is required', Code.PermissionDenied))).toBe(true);
  });
});
