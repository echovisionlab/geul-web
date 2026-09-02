import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./CampaignEditPage.tsx', import.meta.url), 'utf8');

describe('Campaign locale subject wiring', () => {
  it('preserves explicit target empty values and waits for exact room sync before enabling subject input', () => {
    expect(source).toContain('resolveResidentLocaleField({');
    expect(source).toContain('localizedValue: activeEditLocale.displayTitle');
    expect(source).toContain('canEditLocaleDocumentField({');
    expect(source).toContain('isLocaleDocumentSynced: isSynced');
    expect(source).toContain('disabled={!canEditLocalizedSubject}');
    expect(source).not.toContain('activeEditLocale.displayTitle ||');
  });
});
