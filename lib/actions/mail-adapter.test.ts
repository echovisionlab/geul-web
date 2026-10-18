import { beforeEach, expect, it, vi } from 'vitest';
import { MailAdapterType } from '@echovisionlab/geul-proto/secure/mail_adapter_pb.ts';
import { testMailAdapterAction, testMailAdapterConfigAction } from './mail-adapter';

const mocks = vi.hoisted(() => ({ test: vi.fn(), testConfig: vi.fn(), logFailure: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({ createMailAdapterClient: () => mocks }));
vi.mock('@/lib/logging/logger', () => ({ logServerFailure: mocks.logFailure }));
beforeEach(() => vi.resetAllMocks());

it('logs a returned adapter failure with its cause and message correlation', async () => {
  const response = { success: false, error: 'SMTP connection refused', messageId: 'message-1' };
  mocks.test.mockResolvedValue(response);
  await expect(testMailAdapterAction('adapter-1', 'person@example.com')).resolves.toEqual(response);
  expect(mocks.logFailure).toHaveBeenCalledWith(
    'mail-adapter-actions',
    'testMailAdapterAction',
    response.error,
    ['person@example.com'],
    { adapter_id: 'adapter-1', message_id: 'message-1' },
  );
});

it('passes the original transport failure to the shared logger', async () => {
  const error = new Error('SMTP unavailable', { cause: new Error('connection refused') });
  mocks.test.mockRejectedValue(error);
  await expect(testMailAdapterAction('adapter-1', 'person@example.com')).resolves.toEqual({ error: error.message });
  expect(mocks.logFailure).toHaveBeenCalledWith(
    'mail-adapter-actions',
    'testMailAdapterAction',
    error,
    ['person@example.com'],
    { adapter_id: 'adapter-1' },
  );
});

it('passes private configuration values for redaction when a config test returns a failure', async () => {
  const response = { success: false, error: 'SMTP authentication failed', messageId: '' };
  mocks.testConfig.mockResolvedValue(response);
  await expect(
    testMailAdapterConfigAction({
      type: MailAdapterType.SMTP,
      testEmail: 'person@example.com',
      smtpConfig: {
        host: 'smtp.example.com',
        port: 587,
        secure: true,
        user: 'private-user',
        password: 'private-password',
        fromEmail: 'sender@example.com',
      },
    }),
  ).resolves.toEqual(response);
  expect(mocks.logFailure).toHaveBeenCalledWith(
    'mail-adapter-actions',
    'testMailAdapterConfigAction',
    response.error,
    expect.arrayContaining(['private-user', 'private-password', 'person@example.com', 'sender@example.com']),
    { adapter_type: MailAdapterType.SMTP, message_id: '' },
  );
});
