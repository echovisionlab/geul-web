// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { geulFontStylesheets } from '../lib/styles/geul-fonts.generated';
import { applyStorybookDocumentLocale } from './document-locale';

it('restores nested and peer locale owners before restoring the original document attributes', () => {
  const document = window.document.implementation.createHTMLDocument();
  const root = document.documentElement;
  root.lang = 'ja';
  root.dir = 'auto';
  root.dataset.fontProfile = 'host-profile';
  const fontLink = document.createElement('link');
  fontLink.id = 'geul-font-stylesheet';
  fontLink.rel = 'stylesheet';
  fontLink.dataset.fontBaseUrl = '/fonts';
  fontLink.setAttribute('href', '/host.css');
  document.head.append(fontLink);
  const child = applyStorybookDocumentLocale(document, 'en', 1);
  const parent = applyStorybookDocumentLocale(document, 'ar', 0);
  expect([root.lang, root.dir, root.dataset.fontProfile]).toEqual(['en', 'ltr', 'latin']);
  expect(fontLink.getAttribute('href')).toBe(`/fonts/${geulFontStylesheets.latin}`);
  child();
  expect([root.lang, root.dir, root.dataset.fontProfile]).toEqual(['ar', 'rtl', 'arabic']);
  const peer = applyStorybookDocumentLocale(document, 'ko', 0);
  expect(root.lang).toBe('ko');
  expect(fontLink.getAttribute('href')).toBe(`/fonts/${geulFontStylesheets.korean}`);
  parent();
  expect(root.lang).toBe('ko');
  expect(fontLink.getAttribute('href')).toBe(`/fonts/${geulFontStylesheets.korean}`);
  peer();
  expect([root.lang, root.dir, root.dataset.fontProfile]).toEqual(['ja', 'auto', 'host-profile']);
  expect(fontLink.getAttribute('href')).toBe('/host.css');

  const replacement = applyStorybookDocumentLocale(document, 'en');
  peer();
  expect(root.lang).toBe('en');
  replacement();
  expect(root.lang).toBe('ja');
});

it('keeps documents independent and removes originally absent attributes after the last owner exits', () => {
  const firstDocument = window.document.implementation.createHTMLDocument();
  const secondDocument = window.document.implementation.createHTMLDocument();
  const first = applyStorybookDocumentLocale(firstDocument, 'ar');
  const second = applyStorybookDocumentLocale(secondDocument, 'ko');
  first();
  expect(firstDocument.documentElement.hasAttribute('lang')).toBe(false);
  expect(firstDocument.documentElement.hasAttribute('dir')).toBe(false);
  expect(firstDocument.documentElement.hasAttribute('data-font-profile')).toBe(false);
  expect(secondDocument.documentElement.lang).toBe('ko');
  second();
});
