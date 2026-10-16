import { describe, expect, it } from 'vitest';
import { buildEmailPreviewSrcDoc } from './preview-document';

describe('buildEmailPreviewSrcDoc', () => {
  it.each(['ko', 'ja', 'ar', null, undefined])('preserves delivery HTML exactly for locale %s', (locale) => {
    const html =
      '<!DOCTYPE html><html lang="en" dir="ltr"><head><style>body{margin:24px;font-family:serif}</style></head><body><blockquote style="border-left:3px solid #aaa">Quote</blockquote></body></html>';
    expect(buildEmailPreviewSrcDoc(html, locale)).toBe(html);
  });

  it.each(['', '  <p>Fragment with intentional whitespace</p>\n'])(
    'does not wrap or normalize renderer output',
    (html) => {
      expect(buildEmailPreviewSrcDoc(html, 'ko')).toBe(html);
    },
  );
});
