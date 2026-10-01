import { describe, expect, it } from 'vitest';
import type {
  DocumentRoomIntentChange,
  FormDocumentRoomIntentSnapshot,
  PostSeriesDocumentRoomIntentSnapshot,
} from './document-room-intent';
import {
  acknowledgeDocumentRoomIntents,
  getDocumentRoomIntentBatch,
  getDocumentRoomIntents,
  hasDocumentRoomIntents,
  recordDocumentRoomIntent,
} from './document-room-intent-journal';

const ENTITY_ID = '11111111-1111-4111-8111-111111111111';
const DOCUMENT_REVISION = '22222222-2222-4222-8222-222222222222';
const TARGET_REVISION = '33333333-3333-4333-8333-333333333333';
const DOCUMENT_NAME = `post-series:${ENTITY_ID}:ko`;
const AUTHORITY_TEST_DOCUMENT_NAME = `post-series:${ENTITY_ID}:ja`;
const BOUNDARY_TEST_DOCUMENT_NAME = `post-series:${ENTITY_ID}:fr`;
const PREFIX_TEST_DOCUMENT_NAME = `post-series:${ENTITY_ID}:de`;
const FIRST_DOCUMENT = {};
const SECOND_DOCUMENT = {};

function snapshot(
  fields: PostSeriesDocumentRoomIntentSnapshot['fields'],
  overrides: Partial<PostSeriesDocumentRoomIntentSnapshot> = {},
): PostSeriesDocumentRoomIntentSnapshot {
  return {
    documentName: DOCUMENT_NAME,
    documentRevision: DOCUMENT_REVISION,
    sourceLocale: 'en',
    locale: 'ko',
    localeExists: true,
    targetRevision: TARGET_REVISION,
    documentType: 'post_series',
    role: 'target',
    fields,
    ...overrides,
  };
}

function change(
  before: DocumentRoomIntentChange['before'],
  after: DocumentRoomIntentChange['after'],
): DocumentRoomIntentChange {
  return { before, after };
}

function formSnapshot(
  locale: string,
  sourceLocale: string,
  title: string,
  overrides: Partial<FormDocumentRoomIntentSnapshot> = {},
): FormDocumentRoomIntentSnapshot {
  return {
    documentName: `form:${ENTITY_ID}:${locale}`,
    documentRevision: DOCUMENT_REVISION,
    sourceLocale,
    locale,
    localeExists: true,
    ...(locale === sourceLocale ? {} : { targetRevision: TARGET_REVISION }),
    documentType: 'form',
    role: locale === sourceLocale ? 'source' : 'target',
    title,
    hasTitlePresence: true,
    ...overrides,
  };
}

describe('document room intent journal', () => {
  it.each([
    { locale: 'en', sourceLocale: 'en' },
    { locale: 'ko', sourceLocale: 'en' },
  ])(
    'retains a Form title across $locale canonical identity teardown until acknowledged',
    ({ locale, sourceLocale }) => {
      const documentName = `form:${ENTITY_ID}:${locale}`;
      const before = formSnapshot(locale, sourceLocale, 'canonical title');
      const after = formSnapshot(locale, sourceLocale, 'local title');
      const intent = change(before, after);

      expect(recordDocumentRoomIntent(documentName, change(before, before), FIRST_DOCUMENT)).toBe(false);
      expect(recordDocumentRoomIntent(documentName, intent, FIRST_DOCUMENT)).toBe(true);

      const newerCanonical = formSnapshot(locale, sourceLocale, 'peer title', {
        documentRevision: '44444444-4444-4444-8444-444444444444',
        ...(locale === sourceLocale ? {} : { targetRevision: '55555555-5555-4555-8555-555555555555' }),
      });
      expect(getDocumentRoomIntentBatch(documentName, newerCanonical, SECOND_DOCUMENT)).toMatchObject({
        changes: [intent],
        requiresReplay: true,
      });

      const otherLocale = formSnapshot(locale === 'ko' ? 'ja' : 'ko', sourceLocale, 'other locale');
      const otherSource = formSnapshot(locale, 'fr', 'other source');
      const otherEntity = {
        ...newerCanonical,
        documentName: `form:99999999-9999-4999-8999-999999999999:${locale}`,
      };
      expect(getDocumentRoomIntents(documentName, otherLocale)).toEqual([]);
      expect(getDocumentRoomIntents(documentName, otherSource)).toEqual([]);
      expect(getDocumentRoomIntents(documentName, otherEntity)).toEqual([]);
      expect(hasDocumentRoomIntents(documentName, newerCanonical)).toBe(true);
      expect(acknowledgeDocumentRoomIntents(documentName, [intent])).toBe(true);
      expect(hasDocumentRoomIntents(documentName, newerCanonical)).toBe(false);
    },
  );

  it('acknowledges only the captured prefix and preserves changes made during persistence', () => {
    const initial = snapshot({ title: 'initial' });
    const firstAfter = snapshot({ title: 'first local edit' });
    const secondAfter = snapshot({ title: 'later local edit' });
    const first = change(initial, firstAfter);
    const later = change(firstAfter, secondAfter);

    expect(recordDocumentRoomIntent(DOCUMENT_NAME, first, FIRST_DOCUMENT)).toBe(true);
    const capturedPrefix = getDocumentRoomIntents(DOCUMENT_NAME, firstAfter);
    expect(capturedPrefix).toEqual([first]);
    expect(getDocumentRoomIntentBatch(DOCUMENT_NAME, firstAfter, FIRST_DOCUMENT).requiresReplay).toBe(false);
    expect(recordDocumentRoomIntent(DOCUMENT_NAME, later, FIRST_DOCUMENT)).toBe(true);

    expect(acknowledgeDocumentRoomIntents(DOCUMENT_NAME, capturedPrefix)).toBe(true);
    expect(getDocumentRoomIntents(DOCUMENT_NAME, secondAfter)).toEqual([later]);
    expect(hasDocumentRoomIntents(DOCUMENT_NAME, secondAfter)).toBe(true);
  });

  it('retains old authority internally without exposing it to a different source or locale', () => {
    const before = snapshot({ title: 'baseline' }, { documentName: AUTHORITY_TEST_DOCUMENT_NAME, locale: 'ja' });
    const after = snapshot(
      { title: 'local translation' },
      { documentName: AUTHORITY_TEST_DOCUMENT_NAME, locale: 'ja' },
    );
    const intent = change(before, after);
    expect(recordDocumentRoomIntent(AUTHORITY_TEST_DOCUMENT_NAME, intent, FIRST_DOCUMENT)).toBe(true);

    const changedSource = snapshot(
      { title: 'new source' },
      {
        documentName: AUTHORITY_TEST_DOCUMENT_NAME,
        locale: 'ja',
        sourceLocale: 'fr',
      },
    );
    const changedLocale = snapshot(
      { title: 'different locale' },
      {
        documentName: AUTHORITY_TEST_DOCUMENT_NAME,
        locale: 'fr',
      },
    );
    expect(getDocumentRoomIntents(AUTHORITY_TEST_DOCUMENT_NAME, changedSource)).toEqual([]);
    expect(hasDocumentRoomIntents(AUTHORITY_TEST_DOCUMENT_NAME, changedSource)).toBe(false);
    expect(getDocumentRoomIntents(AUTHORITY_TEST_DOCUMENT_NAME, changedLocale)).toEqual([]);
    expect(hasDocumentRoomIntents(AUTHORITY_TEST_DOCUMENT_NAME, changedLocale)).toBe(false);

    expect(getDocumentRoomIntentBatch(AUTHORITY_TEST_DOCUMENT_NAME, after, SECOND_DOCUMENT)).toMatchObject({
      changes: [intent],
      requiresReplay: true,
    });
  });

  it('rejects changes that cross room authority boundaries', () => {
    const before = snapshot({ title: 'baseline' }, { documentName: BOUNDARY_TEST_DOCUMENT_NAME, locale: 'fr' });
    const wrongRoom = snapshot({ title: 'wrong room' }, { documentName: `post-series:${ENTITY_ID}:en`, locale: 'en' });
    const wrongRole = snapshot({ title: 'wrong role' }, { documentName: BOUNDARY_TEST_DOCUMENT_NAME, role: 'source' });

    expect(recordDocumentRoomIntent(BOUNDARY_TEST_DOCUMENT_NAME, change(before, wrongRoom), FIRST_DOCUMENT)).toBe(
      false,
    );
    expect(recordDocumentRoomIntent(BOUNDARY_TEST_DOCUMENT_NAME, change(before, wrongRole), FIRST_DOCUMENT)).toBe(
      false,
    );
    expect(hasDocumentRoomIntents(BOUNDARY_TEST_DOCUMENT_NAME, before)).toBe(false);
  });

  it('refuses to acknowledge a stale or non-prefix snapshot', () => {
    const before = snapshot({ title: 'baseline' }, { documentName: PREFIX_TEST_DOCUMENT_NAME, locale: 'de' });
    const after = snapshot({ title: 'local edit' }, { documentName: PREFIX_TEST_DOCUMENT_NAME, locale: 'de' });
    expect(recordDocumentRoomIntent(PREFIX_TEST_DOCUMENT_NAME, change(before, after), FIRST_DOCUMENT)).toBe(true);

    expect(acknowledgeDocumentRoomIntents(PREFIX_TEST_DOCUMENT_NAME, [change(after, before)])).toBe(false);
    expect(getDocumentRoomIntents(PREFIX_TEST_DOCUMENT_NAME, after)).toEqual([change(before, after)]);
  });
});
