import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTranslator, type AbstractIntlMessages } from 'next-intl';
import { describe, expect, it } from 'vitest';
import type enMessages from '@/messages/en.json';
import { SUPPORTED_LOCALES } from './locale';

const ACCESSIBILITY_KEYS = [
  'fileManager.selectionUnavailableDescription',
  'editorCommon.editor.math.selectBlock',
  'dataTable.aria.selectAllRows',
  'dataTable.aria.selectRow',
  'dataTable.aria.resultSummary',
  'dataTable.aria.loadingMessage',
  'dataTable.pagination.navigation',
  'dataTable.sort.aria.directionAscending',
  'dataTable.sort.aria.directionDescending',
  'dataTable.filter.aria.logic',
  'pageEditor.a11y.columnsPosition',
  'pageEditor.a11y.dragCancel',
  'pageEditor.a11y.dragEnd',
  'pageEditor.a11y.dragInstructions',
  'pageEditor.a11y.dragOver',
  'pageEditor.a11y.dragStart',
  'pageEditor.a11y.sectionAdded',
  'pageEditor.a11y.sectionDeleted',
  'pageEditor.a11y.sectionPosition',
  'socialLinks.reorderInstructions',
  'socialLinks.positionChanged',
] as const;

const values = {
  label: 'ROW_TARGET_SENTINEL',
  section: 'SECTION_TARGET_SENTINEL',
  column: 'COLUMN_TARGET_SENTINEL',
  count: 731,
  index: 17,
  position: 17,
  page: 3,
  totalPages: 29,
};

function loadRawMessages(locale: string): typeof enMessages {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'messages', `${locale}.json`), 'utf8')) as typeof enMessages;
}

function lookup(messages: AbstractIntlMessages, key: string): unknown {
  return key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, messages);
}

// Exercise the shipped raw bundle, without English fallback or placeholder-only regex parsing.
describe.each(SUPPORTED_LOCALES)('%s accessibility message runtime', (locale) => {
  it('contains and formats all semantic-only messages with next-intl, preserving target identifiers', () => {
    const messages = loadRawMessages(locale);
    const errors: unknown[] = [];
    const translate = createTranslator({ locale, messages, onError: (error) => errors.push(error) });
    for (const key of ACCESSIBILITY_KEYS) {
      const raw = lookup(messages, key);
      expect(typeof raw, `${locale}:${key} raw message`).toBe('string');
      expect(String(raw).trim(), `${locale}:${key} empty message`).not.toBe('');
      const formatted = translate(key, values);
      expect(formatted.trim(), `${locale}:${key} formatted message`).not.toBe('');
      expect(formatted, `${locale}:${key} fallback key`).not.toBe(key);
      expect(formatted, `${locale}:${key} unresolved ICU`).not.toMatch(/[{}]|__P\d+__/);
      for (const token of ['label', 'section', 'column'] as const) {
        if (String(raw).includes(`{${token}}`)) {
          expect(formatted, `${locale}:${key} retains ${token}`).toContain(values[token]);
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it('formats zero-page results without consuming or announcing an impossible page number', () => {
    const errors: unknown[] = [];
    const translate = createTranslator({
      locale,
      messages: loadRawMessages(locale),
      onError: (error) => errors.push(error),
    });
    const withoutPage = translate('dataTable.aria.resultSummary', { count: 0, totalPages: 0 });
    const firstPage = translate('dataTable.aria.resultSummary', { count: 0, totalPages: 0, page: 1 });
    const sentinelPage = translate('dataTable.aria.resultSummary', { count: 0, totalPages: 0, page: 991337 });
    expect(errors).toEqual([]);
    expect(withoutPage.trim()).not.toBe('');
    expect(withoutPage).toBe(firstPage);
    expect(sentinelPage).toBe(firstPage);
    expect(withoutPage).not.toContain('1/0');
    expect(withoutPage).not.toContain('991337');
    expect(withoutPage).not.toMatch(/[{}]/);
  });
});
