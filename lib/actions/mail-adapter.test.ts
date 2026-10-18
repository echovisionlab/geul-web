import { beforeEach, expect, it, vi } from 'vitest';
import { MailAdapterType } from '@echovisionlab/geul-proto/secure/mail_adapter_pb.ts';
import { testMailAdapterConfigAction } from './mail-adapter';

const mocks = vi.hoisted(() => ({ test: vi.fn(), testConfig: vi.fn(), logFailure: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({ createMailAdapterClient: () => mocks }));
vi.mock('@/lib/logging/logger', () => ({ logServerFailure: mocks.logFailure }));
beforeEach(() => vi.resetAllMocks());

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
