import { DEFAULT_LOCALE, getLocaleDirection, getLocaleFontProfile, normalizeLocale } from '@/lib/i18n/locale';
import { getPublicCdnUrl } from '@/lib/public-runtime-config';

const NOTO_FONT_STYLESHEET_QUERY =
  '/fonts/css2?family=Noto+Sans:wght@100..900&family=Noto+Sans+Arabic:wght@100..900&family=Noto+Sans+KR:wght@100..900&family=Noto+Sans+JP:wght@100..900&family=Noto+Sans+SC:wght@100..900&family=Noto+Sans+TC:wght@100..900&family=Noto+Sans+HK:wght@100..900&family=Noto+Sans+Mono:wght@100..900&family=Noto+Color+Emoji&display=swap';

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function getEmailPreviewFontStack(locale: string | null | undefined): string {
  switch (getLocaleFontProfile(locale)) {
    case 'korean':
      return "'Noto Sans KR', 'Noto Sans', 'Noto Color Emoji', sans-serif";
    case 'japanese':
      return "'Noto Sans JP', 'Noto Sans', 'Noto Color Emoji', sans-serif";
    case 'chinese-simplified':
      return "'Noto Sans SC', 'Noto Sans', 'Noto Color Emoji', sans-serif";
    case 'chinese-traditional':
      return "'Noto Sans TC', 'Noto Sans', 'Noto Color Emoji', sans-serif";
    case 'arabic':
      return "'Noto Sans Arabic', 'Noto Sans', 'Noto Color Emoji', sans-serif";
    case 'latin':
    default:
      return "'Noto Sans', 'Noto Color Emoji', sans-serif";
  }
}

function buildEmailPreviewHeadInjection(locale: string | null | undefined): string {
  const normalizedLocale = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  const dir = getLocaleDirection(normalizedLocale);
  const cdnUrl = trimTrailingSlash(getPublicCdnUrl());
  const fontHref = `${cdnUrl}${NOTO_FONT_STYLESHEET_QUERY}`;
  const fontStack = getEmailPreviewFontStack(normalizedLocale);

  return [
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<link rel="stylesheet" href="${fontHref}" data-geul-email-preview-fonts="true" />`,
    '<style data-geul-email-preview-font-style="true">',
    ':root { color-scheme: light; }',
    `html, body { margin: 0; padding: 0; font-family: ${fontStack} !important; direction: ${dir}; }`,
    `body, table, tbody, thead, tfoot, tr, td, th, p, div, span, a, li, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, strong, em, small, button, input, textarea, select { font-family: ${fontStack} !important; }`,
    "pre, code, kbd, samp { font-family: 'Noto Sans Mono', 'Noto Color Emoji', monospace !important; }",
    '</style>',
  ].join('');
}

function injectIntoHtmlDocument(html: string, locale: string | null | undefined, normalizedLocale: string): string {
  const injection = buildEmailPreviewHeadInjection(locale);
  let result = html;

  if (!/<!doctype/i.test(result)) {
    result = `<!DOCTYPE html>${result}`;
  }

  if (/<head[\s>]/i.test(result)) {
    result = result.replace(/<head([^>]*)>/i, `<head$1>${injection}`);
  } else {
    result = result.replace(/<html([^>]*)>/i, `<html$1><head>${injection}</head>`);
  }

  result = result.replace(
    /<html([^>]*)>/i,
    `<html$1 lang="${normalizedLocale}" dir="${getLocaleDirection(normalizedLocale)}">`,
  );
  return result;
}

export function buildEmailPreviewSrcDoc(html: string, locale: string | null | undefined): string {
  const normalizedLocale = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  const trimmedHtml = html.trim();
  if (trimmedHtml === '') {
    return '';
  }

  if (/<html[\s>]/i.test(trimmedHtml) || /<!doctype/i.test(trimmedHtml)) {
    return injectIntoHtmlDocument(trimmedHtml, normalizedLocale, normalizedLocale);
  }

  const injection = buildEmailPreviewHeadInjection(normalizedLocale);
  return [
    '<!DOCTYPE html>',
    `<html lang="${normalizedLocale}" dir="${getLocaleDirection(normalizedLocale)}">`,
    `<head>${injection}</head>`,
    `<body>${html}</body>`,
    '</html>',
  ].join('');
}
