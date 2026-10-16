import { Code, ConnectError } from '@connectrpc/connect';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ emit: vi.fn() }));
vi.mock('@opentelemetry/api-logs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@opentelemetry/api-logs')>();
  return { ...actual, logs: { getLogger: () => ({ emit: mocks.emit, enabled: () => true }) } };
});

import { logServerFailure } from './logger';
import { failureCause } from './failure-cause';

afterEach(() => vi.clearAllMocks());

describe('server failure diagnostics', () => {
  it('logs a caught Next not-found fallback at warning level', () => {
    const error = Object.assign(new Error('NEXT_HTTP_ERROR_FALLBACK;404'), {
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    });
    logServerFailure('work-share-access', 'accessWorkShareAction', error);
    expect(mocks.emit).toHaveBeenCalledWith(expect.objectContaining({ severityText: 'WARN' }));
  });
  it.each([
    [Code.Internal, 'ERROR'],
    [Code.Unavailable, 'ERROR'],
    [Code.InvalidArgument, 'WARN'],
    [Code.Unauthenticated, 'WARN'],
    [Code.FailedPrecondition, 'WARN'],
  ])('retains the cause and operation for RPC code %s', (code, severityText) => {
    const cause = new Error('SMTP connection refused');
    const error = new ConnectError('delivery failed', code, undefined, undefined, cause);
    logServerFailure('email-actions', 'sendTestEmail', error);
    expect(mocks.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        severityText,
        attributes: expect.objectContaining({
          module: 'email-actions',
          operation: 'sendTestEmail',
          rpc_code: code,
          failure_cause: expect.stringContaining('SMTP connection refused'),
        }),
      }),
    );
  });

  it('redacts sensitive values at each cause without serializing errors or bodies', () => {
    const error = new Error('fetch failed https://user:password@host/upload?token=private', {
      cause: new Error('SMTP rejected person@example.com password=hunter2'),
    });
    Object.assign(error, { response: { body: 'private response', cookie: 'session-secret' } });
    const result = failureCause(error);
    expect(result).toContain('fetch failed https://[redacted]@host/upload?[redacted]');
    expect(result).toContain('SMTP rejected [redacted-email] password=[redacted]');
    expect(result).not.toMatch(/person@example|hunter2|private|session-secret|user:password/);
  });

  it('retains template tags, SQL identifiers, braces and quoted diagnostics', () => {
    const message = 'template <section>: unknown field {name}; relation "mail_jobs" missing column \'template_id\'';
    expect(failureCause(new Error(message))).toBe(message);
  });

  it('redacts explicitly private values through wrapped causes', () => {
    const error = new Error('template <section> failed for Jane Doe', {
      cause: new Error('invalid code "123456" for 12 Private Street'),
    });
    expect(failureCause(error, ['Jane Doe', '123456', '12 Private Street'])).toBe(
      'template <section> failed for [redacted] <- invalid code "[redacted]" for [redacted]',
    );
  });

  it('keeps explicit private values out of emitted records', () => {
    logServerFailure('newsletter-actions', 'unsubscribe', new Error('rejected signed-token'), ['signed-token']);
    expect(mocks.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.objectContaining({ failure_cause: 'rejected [redacted]' }),
      }),
    );
    expect(JSON.stringify(mocks.emit.mock.calls)).not.toContain('signed-token');
  });

  it('retains explicit redactions when a caller logs a rethrown error', () => {
    const error = new Error('rejected signed-token');
    failureCause(error, ['signed-token']);
    expect(failureCause(new Error('request failed', { cause: error }))).toBe('request failed <- rejected [redacted]');
  });

  it('redacts credential fields while retaining following diagnostics', () => {
    expect(failureCause(new Error('{"password":"hunter2","table":"mail_jobs"} connection refused'))).toBe(
      '{"password":[redacted],"table":"mail_jobs"} connection refused',
    );
    expect(failureCause(new Error('Authorization: Bearer private-token'))).not.toContain('private-token');
    expect(failureCause(new Error('Authorization: Bearer private-token; relation "mail_jobs" unavailable'))).toBe(
      'Authorization: [redacted]; relation "mail_jobs" unavailable',
    );
    expect(failureCause(new Error('Cookie: session=private; csrf=secret, connection refused'))).toBe(
      'Cookie: [redacted], connection refused',
    );
  });

  it('removes raw body excerpts from JSON parser errors', () => {
    expect(failureCause(new SyntaxError('Unexpected token, "private request body" is not valid JSON'))).toBe(
      'Unexpected token, "[redacted-body]" is not valid JSON',
    );
    expect(failureCause(new SyntaxError('Unexpected token, "{"name":"Jane Doe"}" is not valid JSON'))).toBe(
      'Unexpected token, "[redacted-body]" is not valid JSON',
    );
    expect(failureCause(new Error('upstream JSON: "Jane Doe" is not valid JSON'))).toBe(
      'upstream JSON: "[redacted-body]" is not valid JSON',
    );
  });

  it('redacts nested private form values without losing diagnostic field names', () => {
    expect(
      failureCause(new Error('field address rejected "12 Private Street" for Jane Doe'), [
        { address: ['12 Private Street'], contact: { name: 'Jane Doe' } },
      ]),
    ).toBe('field address rejected "[redacted]" for [redacted]');
    expect(failureCause(new Error('invalid code 123456'), [{ code: 123456 }])).toBe('invalid code [redacted]');
  });

  it('bounds cyclic chains and never stringifies arbitrary rejections', () => {
    const error = new Error('cycle');
    error.cause = error;
    expect(failureCause(error)).toBe('cycle');
    expect(failureCause({ body: 'secret' })).toBe('[non-Error rejection]');
    expect(failureCause('network unavailable')).toBe('network unavailable');
    expect(failureCause(undefined)).toBe('');
    expect(failureCause(new Error('x'.repeat(4096)))).toHaveLength(2048);
  });
});
