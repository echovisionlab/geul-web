#!/usr/bin/env node
// Checks every messages/<locale>.json against messages/en.json, the single source of truth.
//
// Fails when a locale is missing an English key, has a key English does not have, has a
// non-string leaf where English has a string (or the reverse), or when a message's ICU structure
// differs from English: argument names and types ({name}, {n, number}, {d, date}, plural,
// select, selectordinal), select option keys, rich-text tag names, or a message that does not
// parse (the parser also requires `other` in plural). Plural/selectordinal categories may differ
// by language (CLDR), but every plural must cover the categories of its own language (see
// `pluralCategoryProblems`), and a translation may not replace English plural branches with a
// plain `{count}` in a language that has plural forms.
//
//   node scripts/i18n/check-messages.mjs           report and exit 1 on any problem
//   node scripts/i18n/check-messages.mjs --prune   also delete keys English does not have
//
// Missing translations are never filled in here. Add them in Weblate (or the locale file) and
// sync with scripts/i18n/sync-weblate-messages.py.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, TYPE } from '@formatjs/icu-messageformat-parser';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const SOURCE_LOCALE = 'en';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Flattens a message tree to dotted leaf paths. */
export function flattenMessages(value, prefix = '', out = new Map()) {
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      flattenMessages(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.set(prefix, value);
  }
  return out;
}

const KIND_NAMES = {
  [TYPE.argument]: 'simple',
  [TYPE.number]: 'number',
  [TYPE.date]: 'date',
  [TYPE.time]: 'time',
  [TYPE.select]: 'select',
};
const PLURAL_KINDS = new Set(['plural', 'selectordinal']);

/**
 * Structural signature of one ICU message: argument kinds by name, select option keys and tags.
 * Plural branches are walked for nested arguments, but their category keys are not compared
 * because CLDR plural categories differ by language.
 */
export function icuSignature(message) {
  const kinds = new Map();
  const selectOptions = new Set();
  const tags = new Set();
  const addKind = (name, kind) => {
    if (!kinds.has(name)) kinds.set(name, new Set());
    kinds.get(name).add(kind);
  };

  const walk = (elements) => {
    for (const element of elements) {
      switch (element.type) {
        case TYPE.argument:
        case TYPE.number:
        case TYPE.date:
        case TYPE.time:
          addKind(element.value, KIND_NAMES[element.type]);
          break;
        case TYPE.select:
          addKind(element.value, 'select');
          selectOptions.add(`${element.value}:${Object.keys(element.options).sort().join('|')}`);
          for (const option of Object.values(element.options)) walk(option.value);
          break;
        case TYPE.plural:
          addKind(element.value, element.pluralType === 'ordinal' ? 'selectordinal' : 'plural');
          for (const option of Object.values(element.options)) walk(option.value);
          break;
        case TYPE.tag:
          tags.add(element.value);
          walk(element.children);
          break;
        default:
          break; // literal, pound
      }
    }
  };
  walk(parse(message));

  return {
    kinds,
    selectOptions: [...selectOptions].sort(),
    tags: [...tags].sort(),
  };
}

function sameList(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function trySignature(message) {
  try {
    return { signature: icuSignature(message) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function describeKinds(kinds) {
  return (
    [...kinds]
      .map(([name, set]) => `${name}:${[...set].sort().join('/')}`)
      .sort()
      .join(', ') || '-'
  );
}

/** Languages whose CLDR cardinal rules have only `other` need no plural branches. */
function hasPluralForms(locale) {
  try {
    return new Intl.PluralRules(locale).resolvedOptions().pluralCategories.length > 1;
  } catch {
    return true;
  }
}

/**
 * Integers used to decide whether exact `=N` selectors cover a whole CLDR category (for example
 * `=0` covers Arabic `zero`, `=1` covers German `one`). Large round numbers reach the `many`
 * category of French, Spanish, Italian and Portuguese (1 000 000).
 */
const PLURAL_SAMPLES = [
  ...Array.from({ length: 1001 }, (_, index) => index),
  1_100,
  10_000,
  100_000,
  1_000_000,
  2_000_000,
  10_000_000,
  1_000_000_000,
];

const pluralRulesCache = new Map();
function pluralRules(locale, type) {
  const cacheKey = `${locale}:${type}`;
  if (!pluralRulesCache.has(cacheKey)) {
    let rules;
    try {
      rules = new Intl.PluralRules(locale, { type });
    } catch {
      rules = new Intl.PluralRules('en', { type });
    }
    const samplesByCategory = new Map(rules.resolvedOptions().pluralCategories.map((category) => [category, []]));
    for (const sample of PLURAL_SAMPLES) samplesByCategory.get(rules.select(sample))?.push(sample);
    pluralRulesCache.set(cacheKey, samplesByCategory);
  }
  return pluralRulesCache.get(cacheKey);
}

/** Every plural/selectordinal element of a parsed message, with the argument name. */
function pluralElements(elements, out = []) {
  for (const element of elements) {
    if (element.type === TYPE.plural) {
      out.push(element);
      for (const option of Object.values(element.options)) pluralElements(option.value, out);
    } else if (element.type === TYPE.select) {
      for (const option of Object.values(element.options)) pluralElements(option.value, out);
    } else if (element.type === TYPE.tag) {
      pluralElements(element.children, out);
    }
  }
  return out;
}

/** `{n, plural, =0 {…} other {…}}`: only exact selectors besides `other`, so not grammatical number. */
function isExactValueSwitch(element) {
  const keys = Object.keys(element.options);
  return keys.some((key) => key.startsWith('=')) && keys.every((key) => key === 'other' || key.startsWith('='));
}

/**
 * Checks that every plural/selectordinal in `message` has a branch for each CLDR category of
 * `locale` (as reported by Intl.PluralRules). A category is also covered when exact `=N`
 * selectors match every sampled integer in it (`=0` for Arabic `zero`). A plural that has only
 * exact selectors and `other` is a numeric switch rather than grammatical number; it is accepted
 * when English uses the same kind of switch for that argument (`switchArguments`).
 * Extra categories (a `one` branch in Japanese) are harmless and accepted.
 *
 * @returns {string[]} problems, one per incomplete plural
 */
export function pluralCategoryProblems(message, locale, switchArguments = new Set()) {
  const problems = [];
  for (const element of pluralElements(parse(message))) {
    const type = element.pluralType === 'ordinal' ? 'ordinal' : 'cardinal';
    if (isExactValueSwitch(element) && switchArguments.has(`${type}:${element.value}`)) continue;
    const keys = new Set(Object.keys(element.options));
    const exact = new Set([...keys].filter((key) => key.startsWith('=')).map((key) => Number(key.slice(1))));
    const missing = [];
    for (const [category, samples] of pluralRules(locale, type)) {
      if (keys.has(category)) continue;
      if (samples.length > 0 && samples.every((sample) => exact.has(sample))) continue;
      missing.push(category);
    }
    if (missing.length > 0) {
      problems.push(
        `{${element.value}, ${type === 'ordinal' ? 'selectordinal' : 'plural'}} lacks ${locale} categor${missing.length === 1 ? 'y' : 'ies'} ${missing.join(', ')}`,
      );
    }
  }
  return problems;
}

/** Arguments that English formats as an exact-value switch (see `isExactValueSwitch`). */
function exactValueSwitchArguments(message) {
  const switches = new Set();
  const grammatical = new Set();
  for (const element of pluralElements(parse(message))) {
    const id = `${element.pluralType === 'ordinal' ? 'ordinal' : 'cardinal'}:${element.value}`;
    (isExactValueSwitch(element) ? switches : grammatical).add(id);
  }
  return new Set([...switches].filter((id) => !grammatical.has(id)));
}

/**
 * Compares one locale tree with the English tree.
 *
 * - `problems`: structural differences that break or change formatting, plurals that lack the
 *   language's CLDR categories, and translations that drop English plural branches.
 * - `flattenedPlurals`: the keys where English uses plural/selectordinal for an argument but the
 *   translation uses a plain `{arg}` in a language that has plural forms (also in `problems`).
 *
 * @returns {{ missing: string[]; extra: string[]; problems: string[]; flattenedPlurals: string[] }}
 */
export function compareLocaleMessages(englishTree, localeTree, locale = 'und') {
  const english = flattenMessages(englishTree);
  const localized = flattenMessages(localeTree);
  const missing = [...english.keys()].filter((key) => !localized.has(key));
  const extra = [...localized.keys()].filter((key) => !english.has(key));
  const problems = [];
  const flattenedPlurals = [];
  const pluralForms = hasPluralForms(locale);

  for (const [key, englishValue] of english) {
    if (!localized.has(key)) continue;
    const value = localized.get(key);
    if (typeof englishValue !== 'string' || typeof value !== 'string') {
      if (typeof englishValue !== typeof value) {
        problems.push(`${key}: expected ${typeof englishValue}, found ${typeof value}`);
      }
      continue;
    }
    const source = trySignature(englishValue);
    const target = trySignature(value);
    if (source.error || target.error) {
      problems.push(
        `${key}: ${source.error ? 'English message' : 'message'} does not parse (${source.error ?? target.error})`,
      );
      continue;
    }

    const sourceKinds = source.signature.kinds;
    const targetKinds = target.signature.kinds;
    const names = [...new Set([...sourceKinds.keys(), ...targetKinds.keys()])];
    let kindMismatch = false;
    let flattened = false;
    for (const name of names) {
      const from = sourceKinds.get(name);
      const to = targetKinds.get(name);
      if (!from || !to) {
        kindMismatch = true;
        continue;
      }
      // date, time, number and select change how a value is formatted: they must match.
      for (const kind of ['date', 'time', 'number', 'select']) {
        if (from.has(kind) !== to.has(kind)) kindMismatch = true;
      }
      for (const kind of PLURAL_KINDS) {
        // A translation may add plural branches; dropping them loses grammatical number.
        if (from.has(kind) && !to.has(kind)) flattened = true;
      }
    }
    if (kindMismatch) {
      problems.push(
        `${key}: arguments differ (en: ${describeKinds(sourceKinds)}; found: ${describeKinds(targetKinds)})`,
      );
    } else if (flattened && pluralForms) {
      flattenedPlurals.push(key);
      problems.push(`${key}: plural branches dropped (English uses plural; write the language's plural forms)`);
    }
    for (const field of ['selectOptions', 'tags']) {
      if (!sameList(source.signature[field], target.signature[field])) {
        problems.push(
          `${key}: ${field} differ (en: ${source.signature[field].join(', ') || '-'}; found: ${target.signature[field].join(', ') || '-'})`,
        );
      }
    }
    for (const problem of pluralCategoryProblems(value, locale, exactValueSwitchArguments(englishValue))) {
      problems.push(`${key}: ${problem}`);
    }
  }

  return { missing, extra, problems, flattenedPlurals };
}

/** Removes `paths` (dotted leaf paths) from a tree and drops objects left empty. */
export function pruneMessagePaths(tree, paths) {
  const pruned = structuredClone(tree);
  for (const path of paths) {
    const segments = path.split('.');
    const parents = [pruned];
    for (const segment of segments.slice(0, -1)) {
      const next = parents.at(-1)?.[segment];
      if (!isRecord(next)) break;
      parents.push(next);
    }
    if (parents.length !== segments.length) continue;
    delete parents.at(-1)[segments.at(-1)];
    for (let index = parents.length - 1; index > 0; index -= 1) {
      if (Object.keys(parents[index]).length > 0) break;
      delete parents[index - 1][segments[index - 1]];
    }
  }
  return pruned;
}

export function readCatalogues(messagesDir = join(REPO_ROOT, 'messages')) {
  return readdirSync(messagesDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({
      locale: basename(file, '.json'),
      path: join(messagesDir, file),
      tree: JSON.parse(readFileSync(join(messagesDir, file), 'utf8')),
    }));
}

/** Runs the full check. English itself must also parse and cover its plural categories. */
export function checkMessageCatalogues(catalogues) {
  const english = catalogues.find((catalogue) => catalogue.locale === SOURCE_LOCALE);
  if (!english) throw new Error(`messages/${SOURCE_LOCALE}.json is missing`);
  const results = [];
  const englishProblems = [];
  for (const [key, value] of flattenMessages(english.tree)) {
    if (typeof value !== 'string') {
      englishProblems.push(`${key}: English leaves must be strings`);
      continue;
    }
    const { error } = trySignature(value);
    if (error) {
      englishProblems.push(`${key}: English message does not parse (${error})`);
      continue;
    }
    for (const problem of pluralCategoryProblems(value, SOURCE_LOCALE, exactValueSwitchArguments(value))) {
      englishProblems.push(`${key}: ${problem}`);
    }
  }
  results.push({ locale: SOURCE_LOCALE, missing: [], extra: [], problems: englishProblems });
  for (const catalogue of catalogues) {
    if (catalogue.locale === SOURCE_LOCALE) continue;
    const { missing, extra, problems } = compareLocaleMessages(english.tree, catalogue.tree, catalogue.locale);
    results.push({ locale: catalogue.locale, missing, extra, problems });
  }
  return results;
}

function main(argv) {
  const prune = argv.includes('--prune');
  const unknown = argv.filter((argument) => argument !== '--prune');
  if (unknown.length > 0) {
    console.error(`Unknown argument: ${unknown.join(' ')}`);
    return 2;
  }

  const catalogues = readCatalogues();
  let results = checkMessageCatalogues(catalogues);

  if (prune) {
    for (const result of results) {
      if (result.extra.length === 0) continue;
      const catalogue = catalogues.find((candidate) => candidate.locale === result.locale);
      writeFileSync(catalogue.path, `${JSON.stringify(pruneMessagePaths(catalogue.tree, result.extra), null, 2)}\n`);
      console.log(`${result.locale}: pruned ${result.extra.length} key(s) that English does not have`);
    }
    results = checkMessageCatalogues(readCatalogues());
  }

  let failed = false;
  const englishKeyCount = flattenMessages(catalogues.find((catalogue) => catalogue.locale === SOURCE_LOCALE).tree).size;
  for (const { locale, missing, extra, problems } of results) {
    if (missing.length + extra.length + problems.length === 0) continue;
    failed = true;
    console.error(
      `\n${locale}: ${missing.length} missing, ${extra.length} not in English, ${problems.length} ICU problem(s)`,
    );
    for (const key of missing) console.error(`  missing      ${key}`);
    for (const key of extra) console.error(`  not in en    ${key}`);
    for (const problem of problems) console.error(`  icu          ${problem}`);
  }

  if (failed) {
    console.error(
      '\nmessages/en.json is the source of truth. Add missing translations (Weblate, then',
      'scripts/i18n/sync-weblate-messages.py), remove keys English does not have (--prune),',
      'keep ICU arguments, select options and tags identical to English, and give every plural',
      'the CLDR plural categories of its language (Intl.PluralRules(locale).resolvedOptions()).',
    );
    return 1;
  }
  console.log(`i18n catalogues OK: ${catalogues.length} locales × ${englishKeyCount} keys match messages/en.json`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
