import { describe, expect, it, vi } from 'vitest';
import { buildEmailPreviewSrcDoc } from './preview-document';

vi.mock('@/lib/public-runtime-config', () => ({
  getPublicCdnUrl: () => 'https://cdn.example.test',
}));

describe('buildEmailPreviewSrcDoc', () => {
  it('wraps fragment html with a localized noto preview document', () => {
    const result = buildEmailPreviewSrcDoc('<p>Hello</p>', 'ko');

    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<html lang="ko" dir="ltr">');
    expect(result).toContain("font-family: 'Noto Sans KR', 'Noto Sans', 'Noto Color Emoji', sans-serif !important;");
    expect(result).toContain('https://cdn.example.test/fonts/css2?');
    expect(result).toContain('<body><p>Hello</p></body>');
  });

  it('injects font assets into full html documents', () => {
    const result = buildEmailPreviewSrcDoc(
      '<html><head><title>Preview</title></head><body><p>Hello</p></body></html>',
      'ja',
    );

    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<html lang="ja" dir="ltr">');
    expect(result).toContain('<head><meta name="viewport" content="width=device-width, initial-scale=1" />');
    expect(result).toContain("font-family: 'Noto Sans JP', 'Noto Sans', 'Noto Color Emoji', sans-serif !important;");
    expect(result).toContain('<body><p>Hello</p></body>');
  });
});
