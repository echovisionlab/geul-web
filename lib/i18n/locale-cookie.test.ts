import { describe, expect, it } from 'vitest';
import { readLocaleCookie } from './locale-cookie';

describe('locale cookie helpers', () => {
  it('reads and normalizes locale cookie values', () => {
    expect(readLocaleCookie('locale=ko; theme=dark')).toBe('ko');
    expect(readLocaleCookie('theme=dark; locale=pt-BR')).toBe('pt-BR');
    expect(readLocaleCookie('theme=dark; locale=zh-Hant')).toBe('zh-TW');
  });

  it('returns null when locale cookie is missing or unsupported', () => {
    expect(readLocaleCookie('theme=dark')).toBeNull();
    expect(readLocaleCookie('locale=xx')).toBeNull();
  });
});
