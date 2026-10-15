import { Code, ConnectError } from '@connectrpc/connect';
import { describe, expect, it } from 'vitest';
import { connectErrorCode } from './connect-error';
import { connectErrorShapeCode } from './connect-error-shape';

class DerivedConnectError extends ConnectError {}

describe('connectErrorShapeCode', () => {
  const candidates: unknown[] = [
    new ConnectError('denied', Code.PermissionDenied),
    new ConnectError('cause', Code.NotFound, undefined, undefined, new Error('inner')),
    new DerivedConnectError('derived', Code.Unavailable),
    ConnectError.from(new Error('wrapped')),
    Object.assign(new Error('cross-realm'), {
      name: 'ConnectError',
      code: Code.Aborted,
      metadata: new Headers(),
      details: [],
      rawMessage: 'cross-realm',
      cause: undefined,
    }),
    Object.assign(new Error('partial'), { name: 'ConnectError', code: Code.Aborted }),
    { name: 'ConnectError', code: Code.Aborted, metadata: {}, details: [], rawMessage: '', cause: undefined },
    Object.assign(new Error('string code'), {
      name: 'ConnectError',
      code: '5',
      metadata: new Headers(),
      details: [],
      rawMessage: '',
      cause: undefined,
    }),
    new Error('plain'),
    null,
    undefined,
    'ConnectError',
  ];

  it.each(candidates.map((candidate, index) => [index, candidate]))(
    'matches ConnectError instanceof for candidate %i',
    (_index, candidate) => {
      expect(connectErrorShapeCode(candidate)).toBe(connectErrorCode(candidate));
    },
  );
});
