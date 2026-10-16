import { describe, expect, it } from 'vitest';
import { normalizeEmailCampaignPreviewHtml, normalizeEmailCampaignVariable } from './email-preview';

describe('email preview normalization', () => {
  it.each([
    ['recipient_name', '{{recipient_name}}'],
    ['{{site_name}}', '{{site_name}}'],
    ['  recipient_name  ', '{{recipient_name}}'],
    ['   ', ''],
  ])('formats variable %j', (input, expected) => {
    expect(normalizeEmailCampaignVariable(input)).toBe(expected);
  });

  it('preserves placeholder links without requiring an editor or a DOM', () => {
    expect(normalizeEmailCampaignPreviewHtml('<a href="https://{{verification_url}}">Verify</a>')).toBe(
      '<a href="{{verification_url}}">Verify</a>',
    );
  });
});
