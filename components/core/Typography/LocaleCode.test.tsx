// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LocaleCode } from './LocaleCode';
import { formatLocaleCode } from './locale-code';

describe('locale code display contract', () => {
  it.each([
    ['en', 'EN'],
    ['ko', 'KO'],
    ['zh-CN', 'ZH-CN'],
    ['pt_BR', 'PT-BR'],
    ['zh-Hant-TW', 'ZH-HANT-TW'],
    ['es-419', 'ES-419'],
  ])('formats %s without losing region or script', (code, expected) => {
    expect(formatLocaleCode(code)).toBe(expected);
  });
  it('owns secondary xs typography and LTR direction with native accessibility', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<LocaleCode code="pt_BR" aria-label="Portuguese (Brazil)" />);
    const text = host.querySelector('span')!;
    expect(text.textContent).toBe('PT-BR');
    expect(text.dataset.size).toBe('xs');
    expect(text.dataset.weight).toBe('regular');
    expect(text.dataset.tone).toBe('secondary');
    expect(text.getAttribute('dir')).toBe('ltr');
    expect(text.getAttribute('aria-label')).toBe('Portuguese (Brazil)');
  });
});
