import { describe, expect, it } from 'vitest';
import {
  checkMessageCatalogues,
  compareLocaleMessages,
  pluralCategoryProblems,
  pruneMessagePaths,
  readCatalogues,
} from '@/scripts/i18n/check-messages.mjs';
import { SUPPORTED_LOCALES } from './locale';

// messages/en.json is the single source of truth (see docs/i18n.md). The same check runs as
// `pnpm i18n:check` in CI.
describe('message catalogues match English', () => {
  it('has exactly the English key set and ICU structure in every locale', () => {
    const catalogues = readCatalogues();
    expect(catalogues.map((catalogue) => catalogue.locale).sort()).toEqual([...SUPPORTED_LOCALES].sort());

    const failures = checkMessageCatalogues(catalogues).flatMap(({ locale, missing, extra, problems }) => [
      ...missing.map((key: string) => `${locale}: missing ${key}`),
      ...extra.map((key: string) => `${locale}: not in English ${key}`),
      ...problems.map((problem: string) => `${locale}: ${problem}`),
    ]);
    expect(failures).toEqual([]);
  });
});

describe('compareLocaleMessages', () => {
  const english = {
    common: { greeting: 'Hello {name}', count: '{count, plural, one {# item} other {# items}}' },
    rich: 'Read the <link>terms</link>',
    status: '{status, select, open {Open} closed {Closed} other {Unknown}}',
    date: 'Updated {when, date, short}',
  };

  it('reports keys missing from a locale and keys English does not have', () => {
    const result = compareLocaleMessages(
      english,
      {
        common: { greeting: 'Hallo {name}', extra: 'x' },
        rich: english.rich,
        status: english.status,
        date: english.date,
      },
      'de',
    );
    expect(result.missing).toEqual(['common.count']);
    expect(result.extra).toEqual(['common.extra']);
  });

  it('fails on renamed arguments, changed formats, select options and tags', () => {
    const result = compareLocaleMessages(
      english,
      {
        common: { greeting: 'Hallo {nom}', count: '{count, plural, one {# Element} other {# Elemente}}' },
        rich: 'Lies die <a>Bedingungen</a>',
        status: '{status, select, open {Offen} other {Unbekannt}}',
        date: 'Aktualisiert {when}',
      },
      'de',
    );
    expect(result.problems).toEqual([
      expect.stringContaining('common.greeting: arguments differ'),
      expect.stringContaining('rich: tags differ'),
      expect.stringContaining('status: selectOptions differ'),
      expect.stringContaining('date: arguments differ'),
    ]);
  });

  it('fails on dropped plural branches only for languages with plural forms', () => {
    const flattened = { ...english, common: { greeting: 'x {name}', count: '{count} Elemente' } };
    expect(compareLocaleMessages(english, flattened, 'de').flattenedPlurals).toEqual(['common.count']);
    expect(compareLocaleMessages(english, flattened, 'de').problems).toEqual([
      expect.stringContaining('common.count: plural branches dropped'),
    ]);
    for (const locale of ['ja', 'ko', 'zh-CN', 'zh-TW', 'th', 'vi', 'id']) {
      expect(compareLocaleMessages(english, flattened, locale).flattenedPlurals).toEqual([]);
      expect(compareLocaleMessages(english, flattened, locale).problems).toEqual([]);
    }
  });

  it('fails on plurals that lack the CLDR categories of the language', () => {
    const polish = {
      ...english,
      common: { greeting: 'Cześć {name}', count: '{count, plural, one {# element} other {# elementu}}' },
    };
    expect(compareLocaleMessages(english, polish, 'pl').problems).toEqual([
      'common.count: {count, plural} lacks pl categories few, many',
    ]);
  });

  it('fails on messages that do not parse and plurals without other', () => {
    const result = compareLocaleMessages(
      english,
      { ...english, common: { greeting: 'Hallo {name', count: '{count, plural, one {# Element}}' } },
      'de',
    );
    expect(result.problems).toEqual([
      expect.stringContaining('common.greeting: message does not parse'),
      expect.stringContaining('common.count: message does not parse (MISSING_OTHER_CLAUSE)'),
    ]);
  });
});

describe('pluralCategoryProblems', () => {
  it('requires every category that Intl.PluralRules reports for the locale', () => {
    expect(
      pluralCategoryProblems('{n, plural, one {# plik} few {# pliki} many {# plików} other {# pliku}}', 'pl'),
    ).toEqual([]);
    expect(pluralCategoryProblems('{n, plural, one {# файл} other {# файла}}', 'ru')).toEqual([
      '{n, plural} lacks ru categories few, many',
    ]);
    expect(pluralCategoryProblems('{n, plural, one {# fichier} other {# fichiers}}', 'fr')).toEqual([
      '{n, plural} lacks fr category many',
    ]);
    expect(pluralCategoryProblems('{n, plural, one {# Datei} other {# Dateien}}', 'de')).toEqual([]);
    expect(pluralCategoryProblems('{n, plural, other {# Dateien}}', 'de')).toEqual([
      '{n, plural} lacks de category one',
    ]);
  });

  it('accepts exact selectors that cover a whole category', () => {
    expect(
      pluralCategoryProblems(
        '{n, plural, =0 {لا ملفات} one {ملف} two {ملفان} few {# ملفات} many {# ملفًا} other {# ملف}}',
        'ar',
      ),
    ).toEqual([]);
    expect(pluralCategoryProblems('{n, plural, =1 {eine Datei} other {# Dateien}}', 'de')).toEqual([]);
    // Russian `one` also covers 21, 31, …: `=1` alone is not enough.
    expect(
      pluralCategoryProblems('{n, plural, =1 {# файл} few {# файла} many {# файлов} other {# файла}}', 'ru'),
    ).toEqual(['{n, plural} lacks ru category one']);
  });

  it('accepts other-only languages and extra categories', () => {
    for (const locale of ['ja', 'ko', 'zh-CN', 'zh-TW', 'th', 'vi', 'id']) {
      expect(pluralCategoryProblems('{n, plural, other {#件}}', locale)).toEqual([]);
      expect(pluralCategoryProblems('{n, plural, one {#件} other {#件}}', locale)).toEqual([]);
    }
  });

  it('checks nested plurals and selectordinal with ordinal categories', () => {
    expect(
      pluralCategoryProblems(
        '{kind, select, file {{n, plural, one {# file} other {# files}}} other {{n, plural, other {#}}}}',
        'en',
      ),
    ).toEqual(['{n, plural} lacks en category one']);
    expect(pluralCategoryProblems('{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}', 'en')).toEqual([]);
    expect(pluralCategoryProblems('{n, selectordinal, one {#st} other {#th}}', 'en')).toEqual([
      '{n, selectordinal} lacks en categories two, few',
    ]);
  });

  it('accepts an exact-value switch only where English uses one for the argument', () => {
    const message = '{pages, plural, =0 {Keine Ergebnisse} other {Seite {page} von {pages}}}';
    expect(pluralCategoryProblems(message, 'de', new Set(['cardinal:pages']))).toEqual([]);
    expect(pluralCategoryProblems(message, 'de')).toEqual(['{pages, plural} lacks de category one']);
  });
});

describe('checkMessageCatalogues', () => {
  const en = {
    count: '{count, plural, one {# item} other {# items}}',
    pages: '{pages, plural, =0 {No pages} other {Page {page} of {pages}}}',
  };
  const problemsFor = (locale: string, tree: Record<string, string>, english: Record<string, string> = en) =>
    checkMessageCatalogues([
      { locale: 'en', path: 'en.json', tree: english },
      { locale, path: `${locale}.json`, tree },
    ]).find((result) => result.locale === locale)?.problems;

  it('fails on flattened plurals and incomplete categories, with no baseline', () => {
    expect(problemsFor('de', { count: '{count} Elemente', pages: en.pages })).toEqual([
      expect.stringContaining('count: plural branches dropped'),
    ]);
    expect(
      problemsFor('ru', { count: '{count, plural, one {# элемент} other {# элемента}}', pages: en.pages }),
    ).toEqual(['count: {count, plural} lacks ru categories few, many']);
    expect(
      problemsFor('ru', {
        count: '{count, plural, one {# элемент} few {# элемента} many {# элементов} other {# элемента}}',
        pages: '{pages, plural, =0 {Нет страниц} other {Страница {page} из {pages}}}',
      }),
    ).toEqual([]);
    expect(problemsFor('ko', { count: '{count}개 항목', pages: en.pages })).toEqual([]);
  });

  it('checks English plural categories too', () => {
    const english = { count: '{count, plural, other {# items}}' };
    const results = checkMessageCatalogues([{ locale: 'en', path: 'en.json', tree: english }]);
    expect(results.find((result) => result.locale === 'en')?.problems).toEqual([
      'count: {count, plural} lacks en category one',
    ]);
  });
});

describe('pruneMessagePaths', () => {
  it('removes keys and the objects they leave empty without touching the input', () => {
    const tree = { a: { b: { c: 'x' }, d: 'y' }, e: 'z' };
    expect(pruneMessagePaths(tree, ['a.b.c', 'e'])).toEqual({ a: { d: 'y' } });
    expect(tree).toEqual({ a: { b: { c: 'x' }, d: 'y' }, e: 'z' });
  });
});
