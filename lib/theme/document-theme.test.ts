// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { applyDocumentTheme } from './document-theme';
import { getThemeTokens } from './themes';

it('preserves per-document inline values and priorities and restores the existing mode when the last owner exits', () => {
  const document = window.document.implementation.createHTMLDocument();
  const root = document.documentElement;
  root.dataset.geulTheme = 'dark';
  root.style.setProperty('--geul-action-ink', 'var(--test-action-ink)', 'important');
  root.style.setProperty('--geul-brand-color', 'var(--test-brand)');
  const outer = applyDocumentTheme(document, 'ocean-light', 0);
  const inner = applyDocumentTheme(document, 'ocean-dark', 1);
  expect(root.dataset.geulThemeId).toBe('ocean-dark');
  expect(root.style.getPropertyValue('--geul-action-ink')).toBe(getThemeTokens('ocean-dark')['action-ink']);
  outer();
  expect(root.dataset.geulThemeId).toBe('ocean-dark');
  inner();
  expect(root.dataset.geulTheme).toBe('dark');
  expect(root.hasAttribute('data-geul-theme-id')).toBe(false);
  expect(root.style.getPropertyValue('--geul-action-ink')).toBe('var(--test-action-ink)');
  expect(root.style.getPropertyPriority('--geul-action-ink')).toBe('important');
  expect(root.style.getPropertyValue('--geul-surface')).toBe('');
  expect(root.style.getPropertyValue('--geul-brand-color')).toBe('var(--test-brand)');
});

it('selects the deepest owner even when a parent registers later and restores previous peers', () => {
  const document = window.document.implementation.createHTMLDocument();
  const root = document.documentElement;
  const inner = applyDocumentTheme(document, 'ocean-dark', 1);
  const outer = applyDocumentTheme(document, 'ocean-light', 0);
  expect(root.dataset.geulThemeId).toBe('ocean-dark');
  inner();
  expect(root.dataset.geulThemeId).toBe('ocean-light');
  const peer = applyDocumentTheme(document, 'dark', 0);
  expect(root.dataset.geulThemeId).toBe('dark');
  expect(root.style.getPropertyValue('--geul-surface')).toBe('');
  peer();
  expect(root.dataset.geulThemeId).toBe('ocean-light');
  outer();
  expect(root.hasAttribute('data-geul-theme')).toBe(false);
  expect(root.hasAttribute('data-geul-theme-id')).toBe(false);
});

it('keeps separate Storybook documents isolated', () => {
  const firstDocument = window.document.implementation.createHTMLDocument();
  const secondDocument = window.document.implementation.createHTMLDocument();
  const first = applyDocumentTheme(firstDocument, 'ocean-light');
  const second = applyDocumentTheme(secondDocument, 'dark');
  expect(firstDocument.documentElement.dataset.geulThemeId).toBe('ocean-light');
  expect(secondDocument.documentElement.dataset.geulThemeId).toBe('dark');
  first();
  expect(secondDocument.documentElement.dataset.geulThemeId).toBe('dark');
  second();
});
