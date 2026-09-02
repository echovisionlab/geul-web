import { describe, expect, it } from 'vitest';
import { getLocalizedEmailVariableDescription } from '@/lib/i18n/email-template';
import { VARIABLE_DESCRIPTIONS } from '@/lib/types/email-template/system-events';

describe('getLocalizedEmailVariableDescription', () => {
  it('aliases confirm_link to confirm_url', () => {
    const t = (key: string) => key;

    expect(getLocalizedEmailVariableDescription(t, 'confirm_url')).toBe('confirm_url');
    expect(getLocalizedEmailVariableDescription(t, 'confirm_link')).toBe('confirm_url');
  });

  it('includes logo_email_url in the fallback variable catalog', () => {
    expect(VARIABLE_DESCRIPTIONS.logo_email_url).toBe('Email-specific logo URL from site settings (if set)');
  });
});
