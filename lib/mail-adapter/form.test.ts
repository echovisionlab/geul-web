import { describe, expect, it } from 'vitest';
import {
  buildMailAdapterConfigPayload,
  getMailAdapterConfigFingerprint,
  type MailAdapterFormValues,
} from '@/lib/mail-adapter/form';

const baseValues: MailAdapterFormValues = {
  name: ' Gmail SMTP ',
  type: 'smtp',
  isActive: true,
  priority: 0,
  sesRegion: '',
  sesAccessKeyId: '',
  sesSecretAccessKey: '',
  sesFromEmail: '',
  sesFromName: '',
  smtpHost: ' smtp.gmail.com ',
  smtpPort: 465,
  smtpSecure: true,
  smtpUser: ' johndoe@example.com ',
  smtpPassword: ' truzcchpwfridvyy ',
  smtpFromEmail: ' noreply@example.com ',
  smtpFromName: ' Example Studio ',
};

describe('mail adapter form helpers', () => {
  it('normalizes smtp payload fields before submission', () => {
    expect(buildMailAdapterConfigPayload(baseValues)).toEqual({
      sesConfig: undefined,
      smtpConfig: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: 'johndoe@example.com',
        password: 'truzcchpwfridvyy',
        fromEmail: 'noreply@example.com',
        fromName: 'Example Studio',
      },
    });
  });

  it('keeps fingerprint stable when numeric fields arrive as strings', () => {
    const withStringPort: MailAdapterFormValues = {
      ...baseValues,
      smtpPort: '465',
    };

    expect(getMailAdapterConfigFingerprint(withStringPort)).toBe(getMailAdapterConfigFingerprint(baseValues));
  });
});
