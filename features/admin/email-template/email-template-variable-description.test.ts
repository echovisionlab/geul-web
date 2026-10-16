import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import enMessages from '@/messages/en.json';
import { describeEmailTemplateVariable } from './email-template-variable-description';

const catalog = createTranslator({
  locale: 'en',
  messages: enMessages,
  namespace: 'adminList.emailTemplates.detail.variables.catalog',
});
const describeVariable = (name: string) =>
  describeEmailTemplateVariable(name, {
    catalog,
    siteOrigin: () => 'Site origin',
    logoEmailUrl: () => 'Logo URL',
  });

describe('email template variable descriptions', () => {
  it('describes every catalogued variable, including security and delivery variables', () => {
    const names = Object.keys(enMessages.adminList.emailTemplates.detail.variables.catalog);
    for (const name of names) {
      expect(describeVariable(name), name).toBe(
        enMessages.adminList.emailTemplates.detail.variables.catalog[
          name as keyof typeof enMessages.adminList.emailTemplates.detail.variables.catalog
        ],
      );
    }
    for (const name of ['policy_title', 'device', 'ip', 'location', 'request_url', 'unsubscribe_link']) {
      expect(describeVariable(name)).not.toBeNull();
    }
  });

  it('normalizes canonical names and ignores names outside the catalogue', () => {
    expect(describeVariable(' Confirm_Url ')).toBe(describeVariable('confirm_url'));
    expect(describeVariable('confirm_link')).toBeNull();
    expect(describeVariable('site_origin')).toBe('Site origin');
    expect(describeVariable('logo_email_url')).toBe('Logo URL');
    expect(describeVariable('custom_campaign_field')).toBeNull();
  });
});
