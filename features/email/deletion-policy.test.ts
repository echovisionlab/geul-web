import { describe, expect, it } from 'vitest';
import { getEmailTemplateDeleteBlocker, isEmailLayoutDeleteBlocked } from './deletion-policy';

describe('email authoring deletion policy', () => {
  it('blocks only current trigger mappings', () => {
    expect(getEmailTemplateDeleteBlocker({ eventKey: 'welcome' })).toBe('in-use');
    expect(getEmailTemplateDeleteBlocker({})).toBeNull();
  });

  it('blocks a layout only while a current campaign or template references it', () => {
    expect(isEmailLayoutDeleteBlocked({ campaignCount: 1, templateCount: 0 })).toBe(true);
    expect(isEmailLayoutDeleteBlocked({ campaignCount: 0, templateCount: 1 })).toBe(true);
    expect(isEmailLayoutDeleteBlocked({ campaignCount: 0, templateCount: 0 })).toBe(false);
  });
});
