/**
 * Table of validation fixtures for every client-reachable schema module.
 *
 * `equivalence.golden.json` holds the outcomes recorded with the classic `zod` schemas before the
 * `zod/mini` migration; `equivalence.test.ts` replays the table and requires identical outcomes
 * (success, parsed data, issue codes, paths and messages, thrown error messages).
 */
import { create, toJson } from '@bufbuild/protobuf';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { CampaignTargetMode } from '@echovisionlab/geul-proto/secure/campaign_pb.ts';
import * as Y from 'yjs';
import { coerceDateValue } from '@/features/admin/segment/segment-date';
import { parseArtistListProps } from '@/features/page/blocks/artist-grid/schema';
import { parseAuthorListProps } from '@/features/page/blocks/author-list/schema';
import { parseClientMarqueeProps } from '@/features/page/blocks/client-marquee/schema';
import { parseColumnsProps } from '@/features/page/blocks/columns/schema';
import { parseEmbedProps } from '@/features/page/blocks/embed/schema';
import { parseExternalVideoProps } from '@/features/page/blocks/external-video/schema';
import { parseFormProps } from '@/features/page/blocks/form/schema';
import {
  immersiveSceneUnitCopySchema,
  immersiveSceneUnitVisualSchema,
  parseImmersiveSceneConfig,
} from '@/features/page/blocks/immersive-scene/schema';
import { parseLabelListProps } from '@/features/page/blocks/label-list/schema';
import { parseLabelMarqueeProps } from '@/features/page/blocks/label-marquee/schema';
import {
  booleanString,
  collectionSizeSchema,
  imageAspectRatioSchema,
  listLayoutSchema,
  sortOrderSchema,
} from '@/features/page/blocks/list-shared';
import { marqueeCommonSchema, marqueeEntitySchema } from '@/features/page/blocks/marquee/schema';
import { parseMermaidProps } from '@/features/page/blocks/mermaid/schema';
import { parsePostListProps } from '@/features/page/blocks/post-list/schema';
import { parsePostMapProps } from '@/features/page/blocks/post-map/schema';
import { parsePostTableProps } from '@/features/page/blocks/post-table/schema';
import { parseProgramEventListProps } from '@/features/page/blocks/program-event-list/schema';
import { parseReleaseListProps } from '@/features/page/blocks/releases-gallery/schema';
import { parseRichTextProps } from '@/features/page/blocks/rich-text/schema';
import { sectionBaseSchema, sectionSettingsSchema } from '@/features/page/blocks/section-base-schema';
import {
  DEFAULT_SECTION_SETTINGS,
  parseSectionMeta,
  parseSectionMetaSafe,
} from '@/features/page/blocks/section-schema';
import { parseTextMarqueeProps } from '@/features/page/blocks/text-marquee/schema';
import { parseWorkMapProps } from '@/features/page/blocks/work-map/schema';
import { parseWorkTableProps } from '@/features/page/blocks/work-table/schema';
import { parseWorkListProps } from '@/features/page/blocks/works-gallery/schema';
import { parseBlockRoomBootstrap } from '@/lib/collab/block-room-bootstrap';
import { CampaignFieldsSchema } from '@/lib/collab/schemas/campaign-fields.schema';
import { FormFieldsSchema } from '@/lib/collab/schemas/form-fields.schema';
import { TypedMetaMap } from '@/lib/collab/TypedMetaMap';
import { buildForm } from '@/lib/form/build';
import { validateWithZod } from '@/lib/form/validation-core';
import { buildFieldValidator } from '@/lib/form/validation-zod';
import { parseSocialLinks, socialLinksSchema } from '@/lib/types/common/social-links';
import {
  fieldValueSchema,
  formValuesSchema,
  isBoolean,
  isString,
  isStringArray,
  toBooleanValue,
  toStringArrayValue,
  toStringValue,
} from '@/lib/types/form/guards';
import { formListInputSchema, formSchemaZod, formStatusSchema, type FormFieldSchema } from '@/lib/types/form/schema';
import { mapBlockSchema, parseMapBlockProps } from '@/lib/types/map-block/schema';
import { PhoneNumber, phoneNumberDataSchema } from '@/lib/types/phone/PhoneNumber';
import {
  releaseArtistItemSchema,
  releaseCategoryItemSchema,
  releaseFormatItemSchema,
  releaseGenreItemSchema,
  releaseLabelItemSchema,
  releaseListInputSchema,
  releaseStatusSchema,
  releaseStyleItemSchema,
  releaseTrackPendingUploadStatusSchema,
  releaseTypeSchema,
} from '@/lib/types/release/schema';
import {
  createFilterSchema,
  createSimpleListInputSchema,
  createSortSchema,
  identifierSchema,
} from '@/lib/types/trpc/schema';
import { userListInputSchema, userRoleSchema } from '@/lib/types/user/schema';
import {
  readDurablePreparedSession,
  readUploadSession,
  rememberUploadSession,
} from '@/lib/upload/upload-session-store';

/** A schema from either zod entry point (both expose `safeParse`). */
interface SafeParser {
  safeParse: (input: unknown) => { success: boolean; data?: unknown; error?: { issues: readonly object[] } };
}

export interface EquivalenceCase {
  id: string;
  inputs: readonly unknown[];
  run: (input: unknown) => unknown;
}

// === Outcome snapshots (JSON-safe, stable) ===

export function snapshot(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === undefined) {
    return { $undefined: true };
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return { $number: String(value) };
  }
  if (typeof value === 'bigint' || typeof value === 'symbol') {
    return { [`$${typeof value}`]: String(value) };
  }
  if (typeof value === 'function') {
    return { $function: true };
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return { $cycle: true };
  }
  seen.add(value);
  if (value instanceof Date) {
    return { $date: Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString() };
  }
  if (value instanceof Uint8Array) {
    return { $bytes: Array.from(value) };
  }
  if (value instanceof Error) {
    const issues = (value as { issues?: unknown }).issues;
    return {
      $error: true,
      message: value.message,
      ...(Array.isArray(issues) ? { issues: issues.map((issue) => snapshot(issue, seen)) } : {}),
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => snapshot(item, seen));
  }
  const prototype = Object.getPrototypeOf(value);
  const result: Record<string, unknown> = {};
  if (prototype !== Object.prototype && prototype !== null) {
    result.$class = prototype.constructor?.name ?? 'anonymous';
    const toJSON = (value as { toJSON?: unknown }).toJSON;
    if (typeof toJSON === 'function') {
      result.json = snapshot(toJSON.call(value), seen);
      return result;
    }
  }
  for (const key of Object.keys(value)) {
    result[key] = snapshot((value as Record<string, unknown>)[key], seen);
  }
  return result;
}

function outcomeOf(run: () => unknown): unknown {
  try {
    return { returned: snapshot(run()) };
  } catch (error) {
    return { threw: snapshot(error) };
  }
}

function safeParseOutcome(schema: SafeParser, input: unknown): unknown {
  const result = schema.safeParse(input);
  return result.success
    ? { success: true, data: snapshot(result.data) }
    : { success: false, issues: snapshot(result.error?.issues) };
}

function schemaCase(id: string, schema: SafeParser, inputs: readonly unknown[]): EquivalenceCase {
  return { id, inputs, run: (input) => safeParseOutcome(schema, input) };
}

function functionCase(id: string, fn: (input: unknown) => unknown, inputs: readonly unknown[]): EquivalenceCase {
  return { id, inputs, run: (input) => outcomeOf(() => fn(input)) };
}

// === Shared fixture values ===

const UUID = '11111111-1111-4111-8111-111111111111';
const COMMON_BAD_INPUTS = [undefined, null, 0, 'text', true, [], {}] as const;

/** Inputs for a block props parser: defaults, valid overrides, enum violations and wrong types. */
function blockInputs(valid: Record<string, unknown>, invalid: Record<string, unknown>[]): unknown[] {
  return [undefined, null, {}, valid, { ...valid, extraKey: 'kept?' }, ...invalid, 'not-an-object', 42, []];
}

// === Form validation fixtures ===

function field(type: FormFieldSchema['type'], validators: Record<string, unknown>[] = [], extra = {}): FormFieldSchema {
  return {
    id: `${type}-field`,
    key: `${type}Key`,
    type,
    ...(type === 'select' || type === 'multiselect'
      ? {
          options: [
            { id: 'a', value: 'a', label: 'A' },
            { id: 'b', value: 'b', label: 'B' },
          ],
        }
      : {}),
    validation: {
      validators: validators.map((validator, index) => ({ id: `v${index}`, name: `v${index}`, ...validator })),
    },
    ...extra,
  } as FormFieldSchema;
}

const required = { predicate: 'required' };
const requiredCustom = { predicate: 'required', message: 'Custom required' };

const STRING_VALUES = [
  undefined,
  null,
  '',
  ' ',
  'a',
  'abc',
  'abcdef',
  'abcdefghijk',
  'https://example.com/path',
  'not a url',
  'user@example.com',
  'bad@',
  '2024-05-06',
  42,
  true,
  ['a'],
];
const NUMBER_VALUES = [undefined, null, '', 0, -1, 4, 5, 6, 10, 10.5, Number.NaN, '5', true];
const ARRAY_VALUES = [undefined, null, [], ['a'], ['a', 'b'], ['a', 'b', 'c'], [1], 'a', {}];
const BOOLEAN_VALUES = [undefined, null, true, false, 'true', 1];
const DATE_VALUES = [
  undefined,
  null,
  '',
  '1990-01-01',
  '2000-02-29',
  '2008-06-14',
  '2010-06-16',
  '2026-06-12',
  '2026-06-13',
  '2026-06-15',
  '2026-06-16',
  '2099-12-31',
  'not-a-date',
  20260616,
];

const fieldValidatorCases: Array<[string, FormFieldSchema, readonly unknown[]]> = [
  ['text optional', field('text'), STRING_VALUES],
  ['text required', field('text', [required]), STRING_VALUES],
  ['text required custom', field('text', [requiredCustom]), STRING_VALUES],
  [
    'text length',
    field('text', [
      { predicate: 'gte', value: 3 },
      { predicate: 'lte', value: 6 },
    ]),
    STRING_VALUES,
  ],
  [
    'text strict length',
    field('text', [
      { predicate: 'gt', value: '2' },
      { predicate: 'lt', value: 7, message: 'Too long!' },
    ]),
    STRING_VALUES,
  ],
  ['text eq', field('textarea', [required, { predicate: 'eq', value: 3 }]), STRING_VALUES],
  ['text url', field('text', [{ predicate: 'url' }]), STRING_VALUES],
  ['text url custom', field('text', [required, { predicate: 'url', message: 'Bad link' }]), STRING_VALUES],
  ['text regex', field('text', [{ predicate: 'regex', value: '^[a-c]+$' }]), STRING_VALUES],
  ['text regex empty', field('text', [{ predicate: 'regex', value: '' }]), STRING_VALUES],
  ['text unknown predicate', field('text', [{ predicate: 'koreanPhone' }]), STRING_VALUES],
  ['tel', field('tel', [required, { predicate: 'gte', value: 4 }]), STRING_VALUES],
  ['select', field('select', [required]), STRING_VALUES],
  ['email optional', field('email'), STRING_VALUES],
  ['email required', field('email', [required, { predicate: 'email' }]), STRING_VALUES],
  [
    'email length',
    field('email', [
      { predicate: 'lte', value: 10 },
      { predicate: 'regex', value: 'x' },
    ]),
    STRING_VALUES,
  ],
  ['number optional', field('number'), NUMBER_VALUES],
  ['number required', field('number', [required]), NUMBER_VALUES],
  [
    'number bounds',
    field('number', [
      { predicate: 'gt', value: 4 },
      { predicate: 'lt', value: '10' },
    ]),
    NUMBER_VALUES,
  ],
  [
    'number inclusive',
    field('number', [
      { predicate: 'gte', value: 5 },
      { predicate: 'lte', value: 10, message: 'At most ten' },
    ]),
    NUMBER_VALUES,
  ],
  ['number eq', field('number', [required, { predicate: 'eq', value: 5 }]), NUMBER_VALUES],
  ['multiselect optional', field('multiselect'), ARRAY_VALUES],
  ['multiselect required', field('multiselect', [requiredCustom]), ARRAY_VALUES],
  [
    'multiselect counts',
    field('multiselect', [
      { predicate: 'gt', value: 0 },
      { predicate: 'lt', value: 3 },
    ]),
    ARRAY_VALUES,
  ],
  [
    'multiselect inclusive',
    field('multiselect', [
      { predicate: 'gte', value: 2 },
      { predicate: 'lte', value: 2 },
      { predicate: 'eq', value: 2, message: 'Pick two' },
    ]),
    ARRAY_VALUES,
  ],
  ['switch optional', field('switch'), BOOLEAN_VALUES],
  ['switch required', field('switch', [required]), BOOLEAN_VALUES],
  ['checkbox optional', field('checkbox'), BOOLEAN_VALUES],
  ['checkbox required', field('checkbox', [requiredCustom]), BOOLEAN_VALUES],
  ['date optional', field('date'), DATE_VALUES],
  ['date required', field('date', [required]), DATE_VALUES],
  [
    'date range',
    field('date', [
      { predicate: 'minDate', value: '2000-01-01' },
      { predicate: 'maxDate', value: '2030-01-01', message: 'Too late' },
      { predicate: 'minDate', value: 5 },
    ]),
    DATE_VALUES,
  ],
  ['date future', field('date', [{ predicate: 'futureDate' }]), DATE_VALUES],
  ['date past', field('date', [{ predicate: 'pastDate', message: 'Past only' }]), DATE_VALUES],
  ['date weekday', field('date', [{ predicate: 'weekdayOnly' }]), DATE_VALUES],
  ['date min age', field('date', [required, { predicate: 'minAge', value: 18 }]), DATE_VALUES],
  [
    'date max age',
    field('date', [
      { predicate: 'maxAge', value: '30' },
      { predicate: 'minAge', value: 'x' },
    ]),
    DATE_VALUES,
  ],
];

const conditionalFormSchema = {
  id: 'conditional',
  steps: [
    {
      id: 'step-1',
      fields: [
        field('select', [required], { id: 'kind', key: 'kind' }),
        field('text', [required, { predicate: 'gte', value: 3 }], {
          id: 'detail',
          key: 'detail',
          condition: { fieldId: 'kind', operator: 'eq', value: 'a' },
        }),
        field('number', [{ predicate: 'gte', value: 2 }], {
          id: 'count',
          key: 'count',
          condition: {
            logic: 'or',
            conditions: [
              { field: 'kind', operator: 'in', value: ['b'] },
              { fieldId: 'detail', operator: 'exists' },
            ],
          },
        }),
      ],
    },
    {
      id: 'step-2',
      condition: { fieldId: 'kind', operator: 'neq', value: 'a' },
      fields: [
        field('email', [required]),
        field('multiselect', [{ predicate: 'gte', value: 1 }], {
          id: 'tags',
          key: 'tags',
          condition: { fieldId: 'kind', operator: 'eq', value: 'b' },
        }),
      ],
    },
  ],
};

const plainFormSchema = {
  id: 'plain',
  steps: [{ id: 's', fields: [field('text', [required]), field('checkbox', [required]), field('number')] }],
};

const legacyFormSchema = {
  fields: [
    { id: 'legacy-name', name: 'name', type: 'text', required: true, label: 'Name' },
    { id: 'legacy-age', name: 'age', type: 'number', label: 'Age' },
  ],
};

// === Persisted schemas ===

const validFormSchemaValue = {
  id: 'form-1',
  steps: [
    {
      id: 'step-1',
      title: 'Step',
      showTitle: true,
      fields: [
        {
          id: 'f1',
          type: 'text',
          key: 'name',
          validation: { validators: [{ id: 'v', name: 'n', predicate: 'required' }] },
        },
        { id: 'f2', type: 'tel', defaultCountry: 'KR', showValidationIcon: false },
        { id: 'f3', type: 'number', numberType: 'float', decimalPlaces: 2 },
        { id: 'f4', type: 'select', options: [{ id: 'o1', label: 'One', value: '1' }] },
        { id: 'f5', type: 'checkbox', checkboxLabel: 'Agree' },
        { id: 'f6', type: 'date', minDate: '2020-01-01', timezone: 'Asia/Seoul' },
        { id: 'f7', type: 'switch', condition: { fieldId: 'f1', operator: 'exists' } },
      ],
      condition: {
        logic: 'and',
        conditions: [
          { fieldId: 'f1', operator: 'eq', value: 'x' },
          { logic: 'or', conditions: [{ field: 'f3', operator: 'gt', value: 2 }] },
        ],
      },
    },
  ],
};

const filterSchemaAllTypes = createFilterSchema({
  s: 'string',
  n: 'number',
  d: 'date',
  b: 'boolean',
  u: 'uuid',
  a: 'array',
  j: 'jsonb',
});
const singleFilterSchema = createFilterSchema({ only: 'string' });
const sortSchema = createSortSchema(['title', 'created_at'] as const);
const allTypesListInputSchema = createSimpleListInputSchema({ filterSchema: filterSchemaAllTypes, sortSchema });

const FILTER_INPUTS = [
  { field: 's', op: 'eq', value: 'x' },
  { field: 's', op: 'ilike', value: 3 },
  { field: 's', op: 'in', value: ['a', 'b'] },
  { field: 's', op: 'between', value: ['a', 'b'] },
  { field: 'n', op: 'between', value: [1, 2] },
  { field: 'n', op: 'between', value: [1] },
  { field: 'n', op: 'gte', value: '1' },
  { field: 'd', op: 'lt', value: '2024-01-01' },
  { field: 'b', op: 'eq', value: false },
  { field: 'u', op: 'eq', value: UUID },
  { field: 'u', op: 'in', value: [UUID, 'nope'] },
  { field: 'a', op: 'overlaps', value: [1, 'two'] },
  { field: 'j', op: 'jsonContains', value: { any: 'thing' } },
  { field: 'j', op: 'hasAnyKey', value: 'k' },
  { field: 'x', op: 'eq', value: 'x' },
  { field: 's', op: 'unknown', value: 'x' },
  { field: 's', value: 'x' },
  { field: 's', op: 'isNull', value: true, extra: 1 },
  ...COMMON_BAD_INPUTS,
];

const LIST_INPUTS = [
  undefined,
  {},
  { page: 2, pageSize: 50, search: 'q', filterBy: 'OR' },
  { page: 0, pageSize: 101 },
  { page: '1' },
  { filter: [{ field: 's', op: 'eq', value: 'x' }], sort: [{ field: 'title' }, { field: 'created_at', order: 'asc' }] },
  { filter: [{ field: 's', op: 'eq', value: 1 }], sort: [{ field: 'nope', order: 'up' }] },
  { filterBy: 'XOR', extra: true },
];

// === Upload storage ===

function withStorage<T>(entries: Record<string, string>, run: () => T): T {
  const store = new Map(Object.entries(entries));
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { sessionStorage: storage, localStorage: storage },
  });
  try {
    return run();
  } finally {
    if (previous) {
      Object.defineProperty(globalThis, 'window', previous);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  }
}

const SHA = 'a'.repeat(64);
const durableUpload = {
  storageId: 'ns-1',
  sourceFingerprint: 'fp',
  uploadId: 'up',
  bundleId: 'bundle',
  uploadType: 1,
  source: { name: 'a.wav', size: 10, lastModified: 1, type: 'audio/wav' },
  progress: { loadedBytes: 5, percentage: 50 },
  receipts: [{ path: 'p', sha256: SHA }],
};

// === Block-room bootstrap ===

function bootstrapPayload(overrides: Record<string, unknown>): Record<string, unknown> {
  const locale = 'ko';
  const typed = create(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale,
    base: { nodes: [] },
    localeOverlay: { locale, blocks: [] },
  });
  const source = new Y.Doc();
  hydrateCanonicalBlockRoom(source, 'post', locale, typed, []);
  const update = Y.encodeStateAsUpdate(source);
  source.destroy();
  return {
    kind: 'room.bootstrap',
    v: 3,
    bootstrapChallenge: 'challenge-1',
    documentName: `post:${UUID}:${locale}`,
    documentType: 'post',
    document: toJson(LocalizedRichTextDocumentSchema, typed),
    documentRevision: '22222222-2222-4222-8222-222222222222',
    sourceLocale: locale,
    locale,
    localeExists: true,
    presentLocaleValues: [],
    sourceMetadata: { locale },
    documentMetadata: {},
    metadataSequence: 0,
    localeMetadata: { locale },
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    serverInstanceId: 'server-1',
    roomEpoch: '33333333-3333-4333-8333-333333333333',
    yjsBootstrapUpdate: Buffer.from(update).toString('base64'),
    ...overrides,
  };
}

const BOOTSTRAP_OVERRIDES: Record<string, unknown>[] = [
  {},
  { extra: true },
  { v: 1 },
  { bootstrapChallenge: '   ' },
  { documentType: 'unknown' },
  { documentRevision: 'not-a-uuid' },
  { metadataSequence: -1 },
  { metadataSequence: 1.5 },
  { metadataSequence: 3 },
  { yjsBootstrapUpdate: '***' },
  { targetRevision: '  ' },
  { sourceMetadata: { locale: 'ko', creditNotes: [{ creditId: ' c ', note: 'n' }] } },
  { sourceMetadata: { locale: 'ko', creditNotes: [{ creditId: '', note: 'n' }] } },
  { sourceMetadata: { locale: 'ko', unknown: 1 } },
  { localeMetadata: undefined },
  { documentMetadata: [] },
];

// === Cases ===

export const equivalenceCases: EquivalenceCase[] = [
  // Form field validators (public form, share links, admin form preview).
  ...fieldValidatorCases.map(([name, definition, inputs]) =>
    schemaCase(`lib/form/validation-zod buildFieldValidator ${name}`, buildFieldValidator(definition), inputs),
  ),
  ...fieldValidatorCases.map(([name, definition, inputs]) =>
    functionCase(
      `lib/form/validation-core validateWithZod ${name}`,
      (value) => validateWithZod(definition, value),
      inputs,
    ),
  ),
  functionCase(
    'lib/form/validation-core validateWithZod custom messages',
    (value) =>
      validateWithZod(field('text', [required, { predicate: 'gte', value: 3 }, { predicate: 'url' }]), value, {
        required: 'R',
        invalidUrl: 'U',
        invalidFormat: 'F',
        invalidEmail: 'E',
        invalidPhoneNumber: 'P',
        stringGt: (n) => `sgt${n}`,
        stringGte: (n) => `sgte${n}`,
        stringLt: (n) => `slt${n}`,
        stringLte: (n) => `slte${n}`,
        stringEq: (n) => `seq${n}`,
        numberGt: (n) => `ngt${n}`,
        numberGte: (n) => `ngte${n}`,
        numberLt: (n) => `nlt${n}`,
        numberLte: (n) => `nlte${n}`,
        numberEq: (n) => `neq${n}`,
        arrayGt: (n) => `agt${n}`,
        arrayGte: (n) => `agte${n}`,
        arrayLt: (n) => `alt${n}`,
        arrayLte: (n) => `alte${n}`,
        arrayEq: (n) => `aeq${n}`,
        dateMin: (d) => `dmin${d}`,
        dateMax: (d) => `dmax${d}`,
        futureDate: 'FD',
        pastDate: 'PD',
        weekdayOnly: 'WD',
        minAge: (n) => `mina${n}`,
        maxAge: (n) => `maxa${n}`,
      }),
    STRING_VALUES,
  ),
  functionCase(
    'lib/form/build buildForm conditional safeParse',
    (value) => buildForm(conditionalFormSchema as never).safeParse(value),
    [
      undefined,
      {},
      { kind: 'a' },
      { kind: 'a', detail: 'ab' },
      { kind: 'a', detail: 'abcd', count: 1 },
      { kind: 'a', detail: 'abcd', count: 3, emailKey: 'user@example.com' },
      { kind: 'b', emailKey: 'bad', tags: [] },
      { kind: 'b', emailKey: 'user@example.com', tags: ['x'], count: 2 },
      { kind: 'c', emailKey: '', detail: 'zz' },
      { kind: 7, detail: 9, count: 'x', tags: 'y' },
    ],
  ),
  functionCase(
    'lib/form/build buildForm conditional parse',
    (value) => buildForm(conditionalFormSchema as never).parse(value),
    [
      { kind: 'a', detail: 'abcd', emailKey: 'user@example.com' },
      { kind: 'a', detail: 'a' },
    ],
  ),
  functionCase(
    'lib/form/build buildForm plain safeParse',
    (value) => buildForm(plainFormSchema as never).safeParse(value),
    [
      undefined,
      {},
      { textKey: 'x', checkboxKey: true },
      { textKey: '', checkboxKey: false, numberKey: 'n' },
      { textKey: 'x', checkboxKey: true, extra: 1 },
    ],
  ),
  functionCase(
    'lib/form/build buildForm legacy safeParse',
    (value) => buildForm(legacyFormSchema as never).safeParse(value),
    [{}, { name: 'Kim' }, { name: 'Kim', age: 'x' }],
  ),

  // Form value guards and phone numbers.
  schemaCase('lib/types/form/guards fieldValueSchema', fieldValueSchema, [
    'x',
    1,
    false,
    ['a'],
    [1],
    { phone: '010', countryCode: 'KR' },
    { phone: 1 },
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('lib/types/form/guards formValuesSchema', formValuesSchema, [
    {},
    { a: 'x', b: [true] },
    { a: { phone: '1', countryCode: 'US', extra: 1 } },
    ...COMMON_BAD_INPUTS,
  ]),
  functionCase(
    'lib/types/form/guards helpers',
    (value) => ({
      isString: isString(value),
      isBoolean: isBoolean(value),
      isStringArray: isStringArray(value),
      toStringValue: toStringValue(value),
      toBooleanValue: toBooleanValue(value),
      toStringArrayValue: toStringArrayValue(value),
    }),
    ['x', true, ['a', 'b'], ['a', 1], 1, ...COMMON_BAD_INPUTS],
  ),
  schemaCase('lib/types/phone phoneNumberDataSchema', phoneNumberDataSchema, [
    { phone: '010-1234-5678', countryCode: 'KR' },
    { phone: '', countryCode: '' },
    { phone: 1, countryCode: 'KR' },
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('lib/types/phone PhoneNumber.schema', PhoneNumber.schema, [
    { phone: '010-1234-5678', countryCode: 'KR' },
    { phone: '+1 202 555 0143', countryCode: 'US' },
    { phone: 'abc', countryCode: 'ZZ' },
    ...COMMON_BAD_INPUTS,
  ]),
  functionCase(
    'lib/types/phone PhoneNumber.fromUnknown',
    (value) => {
      const phone = PhoneNumber.fromUnknown(value, 'KR');
      return { json: phone.toJSON(), e164: phone.toE164(), valid: phone.isValid };
    },
    [{ phone: '010-1234-5678', countryCode: 'KR' }, '01012345678', { phone: 2 }, ...COMMON_BAD_INPUTS],
  ),

  // Persisted form schema and list inputs.
  schemaCase('lib/types/form/schema formStatusSchema', formStatusSchema, [
    'draft',
    'published',
    'archived',
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('lib/types/form/schema formSchemaZod', formSchemaZod, [
    validFormSchemaValue,
    { id: 'x', steps: [] },
    { id: 'x', steps: [{ id: 's', fields: [{ id: 'f', type: 'unknown' }] }] },
    { id: 'x', steps: [{ id: 's', fields: [{ id: 'f', type: 'number', decimalPlaces: 11 }] }] },
    { id: 'x', steps: [{ id: 's', fields: [{ id: 'f', type: 'number', decimalPlaces: 1.5 }] }] },
    { id: 'x', steps: [{ id: 's', fields: [{ id: 'f', type: 'select', options: [{ id: 'o', value: 'v' }] }] }] },
    { id: 'x', steps: [{ id: 's', condition: { logic: 'xor', conditions: [] } }] },
    { id: 'x', steps: [{ id: 's', condition: { operator: 'between', value: {} } }] },
    {
      id: 'x',
      steps: [
        {
          id: 's',
          condition: { logic: 'and', conditions: [{ logic: 'or', conditions: [{ operator: 'eq', value: [1, 'a'] }] }] },
        },
      ],
    },
    { id: 'x', steps: [{ id: 's', fields: [{ id: 'f', type: 'text', validation: { validators: [{ id: 'v' }] } }] }] },
    { id: 'x', steps: [{ id: 's', fields: [{ id: 'f', type: 'text', extraProp: true }] }], extra: 1 },
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('lib/types/form/schema formListInputSchema', formListInputSchema, [
    ...LIST_INPUTS,
    {
      filter: [
        { field: 'is_public', op: 'eq', value: true },
        { field: 'id', op: 'in', value: [UUID] },
      ],
    },
    {
      filter: [{ field: 'created_at', op: 'between', value: ['2024-01-01', '2024-12-31'] }],
      sort: [{ field: 'status' }],
    },
  ]),
  schemaCase('lib/types/trpc createFilterSchema all value types', filterSchemaAllTypes, FILTER_INPUTS),
  schemaCase('lib/types/trpc createFilterSchema single field', singleFilterSchema, FILTER_INPUTS),
  schemaCase('lib/types/trpc createSortSchema', sortSchema, [
    { field: 'title' },
    { field: 'created_at', order: 'asc' },
    { field: 'title', order: 'sideways' },
    { field: 'nope' },
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('lib/types/trpc createSimpleListInputSchema', allTypesListInputSchema, LIST_INPUTS),
  schemaCase('lib/types/trpc identifierSchema', identifierSchema, [
    { id: UUID },
    { slug: 'post' },
    { id: UUID, slug: 'post' },
    { id: 'not-uuid' },
    { slug: '' },
    {},
    ...COMMON_BAD_INPUTS,
  ]),
  functionCase('lib/types/trpc createFilterSchema empty', () => createFilterSchema({}), [undefined]),
  schemaCase('lib/types/release releaseTypeSchema', releaseTypeSchema, [
    'album',
    'ep',
    'mixtape',
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('lib/types/release releaseStatusSchema', releaseStatusSchema, [
    'draft',
    'published',
    'x',
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('lib/types/release releaseTrackPendingUploadStatusSchema', releaseTrackPendingUploadStatusSchema, [
    'pending',
    'expired',
    'done',
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('lib/types/release releaseListInputSchema', releaseListInputSchema, [
    ...LIST_INPUTS,
    { filter: [{ field: 'release_date', op: 'gte', value: '2020-01-01' }], sort: [{ field: 'type', order: 'asc' }] },
  ]),
  schemaCase('lib/types/release releaseArtistItemSchema', releaseArtistItemSchema, [
    { artist_id: UUID, artist_name: 'A', artist_slug: null, sort_order: 1 },
    { artist_id: 'x', artist_name: 'A', artist_slug: 'a', sort_order: '1' },
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('lib/types/release releaseLabelItemSchema', releaseLabelItemSchema, [
    { label_id: UUID, label_name: 'L', label_slug: 'l', catalog_number: null, sort_order: 0 },
    { label_id: UUID, label_name: 'L', label_slug: undefined, catalog_number: 1, sort_order: 0 },
    ...COMMON_BAD_INPUTS,
  ]),
  ...(
    [
      ['releaseGenreItemSchema', releaseGenreItemSchema],
      ['releaseCategoryItemSchema', releaseCategoryItemSchema],
      ['releaseStyleItemSchema', releaseStyleItemSchema],
    ] as const
  ).map(([name, schema]) =>
    schemaCase(`lib/types/release ${name}`, schema, [
      { id: UUID, name: 'N', slug: 's' },
      { id: UUID, name: 'N' },
      ...COMMON_BAD_INPUTS,
    ]),
  ),
  schemaCase('lib/types/release releaseFormatItemSchema', releaseFormatItemSchema, [
    { id: UUID, name: 'N', slug: 's', format_description: null },
    { id: UUID, name: 'N', slug: 's' },
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('lib/types/user userRoleSchema', userRoleSchema, [
    'admin',
    'author',
    'user',
    'root',
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('lib/types/user userListInputSchema', userListInputSchema, [
    ...LIST_INPUTS,
    { filter: [{ field: 'banned', op: 'isNull', value: false }], sort: [{ field: 'role' }] },
  ]),
  schemaCase('lib/types/common/social-links socialLinksSchema', socialLinksSchema, [
    { github: 'https://github.com/x' },
    { github: 1 },
    ...COMMON_BAD_INPUTS,
  ]),
  functionCase('lib/types/common/social-links parseSocialLinks', parseSocialLinks, [
    '{"x":"https://x.com/a"}',
    '{"x":1}',
    'not json',
    { a: 'b' },
    ...COMMON_BAD_INPUTS,
  ]),

  // Page blocks.
  ...[
    [
      'artist-grid',
      parseArtistListProps,
      { layout: 'carousel', itemSize: 's', columns: '4', sortBy: 'published_at', imageAspectRatio: '16:9' },
      [{ layout: 'masonry' }, { itemSize: 'xl' }, { columns: 4 }, { showMeta: true }],
    ],
    [
      'author-list',
      parseAuthorListProps,
      { source: 'selected', authorIds: 'a,b', layout: 'list', showBio: 'false' },
      [{ source: 'manual' }, { layout: 'cards' }, { showAvatar: 'yes' }],
    ],
    [
      'client-marquee',
      parseClientMarqueeProps,
      {
        direction: 'right',
        speed: 'fast',
        speedPxPerSecond: '30',
        source: 'selected',
        ids: 'a',
        logoScale: 'fill-height',
      },
      [{ direction: 'up' }, { speedPxPerSecond: 30 }, { linkMode: 'url' }],
    ],
    [
      'label-marquee',
      parseLabelMarqueeProps,
      { itemHeight: 'xl', gap: 'sm', pauseOnHover: 'false', fallbackMode: 'hide', limit: '4' },
      [{ itemHeight: 'xxl' }, { limit: 4 }],
    ],
    [
      'text-marquee',
      parseTextMarqueeProps,
      { itemsJson: '[{"text":"a"}]', linkTarget: 'new-tab', itemHeightPx: '40' },
      [{ itemsJson: [] }, { linkTarget: 'popup' }],
    ],
    [
      'columns',
      parseColumnsProps,
      { columns: '3', gap: '8', columnRatios: '1:2:1', mobileStack: 'false' },
      [{ columns: '5' }, { columns: 3 }],
    ],
    [
      'embed',
      parseEmbedProps,
      {
        uri: 'https://x',
        title: 't',
        heightMode: 'auto',
        height: '480',
        allowScripts: 'false',
        allowFullscreen: 'true',
      },
      [
        { height: '0' },
        { height: '12.5' },
        { height: '999999' },
        { height: 480 },
        { heightMode: 'fill' },
        { allowForms: 'maybe' },
      ],
    ],
    [
      'external-video',
      parseExternalVideoProps,
      { url: 'https://youtu.be/x', caption: 'c', aspectRatio: '9:16' },
      [{ aspectRatio: '21:9' }, { url: null }],
    ],
    ['form', parseFormProps, { formId: 'f', showTitle: 'false' }, [{ showTitle: false }, { formId: 1 }]],
    [
      'label-list',
      parseLabelListProps,
      { layout: 'minimal', sortOrder: 'desc', limit: '3' },
      [{ sortOrder: 'random' }, { sortBy: 'title' }],
    ],
    [
      'mermaid',
      parseMermaidProps,
      { source: 'graph TD; A-->B', title: 'Flow' },
      [{ source: 'x'.repeat(100_001) }, { title: 3 }],
    ],
    [
      'post-list',
      parsePostListProps,
      {
        layout: 'cards',
        categoryIds: 'a',
        sortBy: 'title',
        sortOrder: 'asc',
        showFeaturedImage: 'false',
        imageAspectRatio: '4:3',
      },
      [{ sortBy: 'views' }, { limit: 6 }],
    ],
    [
      'post-map',
      parsePostMapProps,
      {
        requirePlace: 'false',
        aspectRatio: '1:1',
        minZoom: '3',
        maxZoom: '18.5',
        primaryLabel: 'place_name',
        preferredScheme: 'dark',
      },
      [{ minZoom: '0' }, { maxZoom: 'abc' }, { maxZoom: '99' }, { primaryLabel: 'title' }, { areaLabelsMode: 'auto' }],
    ],
    [
      'post-table',
      parsePostTableProps,
      { statuses: 'POST_STATUS_PUBLISHED', pageSize: '25' },
      [{ pageSize: 25 }, { filterFields: null }],
    ],
    [
      'program-event-list',
      parseProgramEventListProps,
      { timeWindow: 'past', sortBy: 'ends_at', sortOrder: 'desc', typeIds: 'a,b' },
      [{ timeWindow: 'future' }, { sortBy: 'created_at' }],
    ],
    [
      'releases-gallery',
      parseReleaseListProps,
      { types: 'album,ep', sortBy: 'title', layout: 'list', imageAspectRatio: 'auto' },
      [{ sortBy: 'popularity' }, { imageAspectRatio: '3:2' }],
    ],
    ['rich-text', parseRichTextProps, { anything: 'goes' }, [{ nested: { a: 1 } }]],
    [
      'work-map',
      parseWorkMapProps,
      { workTypes: 'film', featuredOnly: 'true', minZoom: '2', maxZoom: '20', poiLabelsMode: 'show' },
      [{ minZoom: '-1' }, { maxZoom: '' }, { featuredOnly: 'yes' }],
    ],
    [
      'work-table',
      parseWorkTableProps,
      { workTypes: 'film', featuredOnly: 'true', pageSize: '5' },
      [{ featuredOnly: true }, { statuses: [] }],
    ],
    [
      'works-gallery',
      parseWorkListProps,
      { layout: 'carousel', workTypes: 'film', sortBy: 'updated_at', carouselLoop: 'false' },
      [{ sortBy: 'year' }, { carouselLoop: false }],
    ],
    [
      'map',
      parseMapBlockProps,
      {
        mapPlaceIds: 'a,b',
        zoom: '12',
        minZoom: '2',
        maxZoom: '19',
        centerLat: '37.5',
        centerLng: '127.0',
        rotatable: 'true',
        variant: 'default',
        caption: 'Map',
      },
      [
        { centerLat: '91' },
        { centerLng: 'east' },
        { zoom: '0' },
        { minZoom: 'x' },
        { variant: 'satellite' },
        { mapPlaceId: 'legacy', location: '{"lat":10,"lng":20}' },
        { location: '{"lat":100,"lng":20}' },
        { centerLat: 37 },
      ],
    ],
  ].map(([name, parse, valid, invalid]) =>
    functionCase(
      `features/page/blocks ${name as string} parse`,
      parse as (value: unknown) => unknown,
      blockInputs(valid as Record<string, unknown>, invalid as Record<string, unknown>[]),
    ),
  ),
  schemaCase('lib/types/map-block mapBlockSchema', mapBlockSchema, [
    {},
    { zoom: '3', extra: 1 },
    { zoom: '30' },
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('features/page/blocks list-shared collectionSizeSchema', collectionSizeSchema, [
    's',
    'm',
    'l',
    'xl',
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('features/page/blocks list-shared booleanString', booleanString, [
    'true',
    'false',
    'TRUE',
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('features/page/blocks list-shared listLayoutSchema', listLayoutSchema, [
    'grid',
    'carousel',
    'x',
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('features/page/blocks list-shared imageAspectRatioSchema', imageAspectRatioSchema, [
    '1:1',
    '3:2',
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('features/page/blocks list-shared sortOrderSchema', sortOrderSchema, [
    'asc',
    'desc',
    'up',
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('features/page/blocks marquee marqueeCommonSchema', marqueeCommonSchema, [
    {},
    { direction: 'left', source: 'all' },
    { speed: 'warp' },
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('features/page/blocks marquee marqueeEntitySchema', marqueeEntitySchema, [
    {},
    { source: 'selected', ids: 'a,b' },
    { source: 'some' },
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('features/page/blocks section-base sectionSettingsSchema', sectionSettingsSchema, [
    {},
    { backgroundColor: 'paper-fixture', paddingTop: '8', maxWidth: 'narrow' },
    { maxWidth: 'wide' },
    { paddingTop: 8 },
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('features/page/blocks section-base sectionBaseSchema', sectionBaseSchema, [
    { id: 's' },
    { id: 's', settings: {} },
    { id: 's', settings: { maxWidth: 'x' } },
    { settings: {} },
    ...COMMON_BAD_INPUTS,
  ]),
  functionCase('features/page/blocks section-schema DEFAULT_SECTION_SETTINGS', () => DEFAULT_SECTION_SETTINGS, [
    undefined,
  ]),
  ...(['parseSectionMeta', 'parseSectionMetaSafe'] as const).map((name) =>
    functionCase(
      `features/page/blocks section-schema ${name}`,
      name === 'parseSectionMeta' ? parseSectionMeta : parseSectionMetaSafe,
      [
        { id: 's1', type: 'rich-text' },
        { id: 's1', type: 'rich-text', props: {}, settings: { paddingTop: '4' } },
        { id: 's2', type: 'post-list', props: { layout: 'grid', limit: '3' } },
        { id: 's2', type: 'post-list', props: { layout: 'masonry' } },
        { id: 's3', type: 'map', props: { mapPlaceId: 'p', location: '{"lat":1,"lng":2}' } },
        { id: 's3', type: 'map', props: { zoom: '99' } },
        { id: 's4', type: 'embed', props: { height: '1' } },
        { id: 's5', type: 'unknown' },
        { id: 's6', type: 'immersive-scene', props: { playback: 'autoplay', textureSize: '128' } },
        {
          id: 'c1',
          type: 'columns',
          props: { columns: '2' },
          columns: [
            {
              id: 'col1',
              sections: [
                { id: 'n1', type: 'rich-text' },
                { id: 'n2', type: 'map', props: { mapPlaceId: 'x' } },
              ],
            },
            { id: 'col2', sections: [] },
          ],
        },
        {
          id: 'c2',
          type: 'columns',
          props: { columns: '2' },
          columns: [{ id: 'col1', sections: [{ id: 'n', type: 'columns', columns: [] }] }],
        },
        { id: 'c3', type: 'columns', columns: [{ id: 'col1', sections: [{ id: 'n', type: 'immersive-scene' }] }] },
        { id: 'c4', type: 'columns', columns: 'none' },
        { id: 'c5', type: 'columns' },
        { type: 'rich-text' },
        ...COMMON_BAD_INPUTS,
      ],
    ),
  ),
  functionCase('features/page/blocks immersive-scene parseImmersiveSceneConfig', parseImmersiveSceneConfig, [
    ...blockInputs(
      {
        unitsJson: JSON.stringify([
          { id: 'u1', mesh: 'box', color: 'ink-fixture', meshOptimizationQuality: '40', scale: '2' },
          { id: '', mesh: 'box' },
          { id: 'u3', mesh: 'hexagon' },
          { mesh: 'cone' },
          'not-an-object',
          { id: 'u5', meshOptimizationMethod: 'meshopt' },
          { id: 'u6', textureSource: 'image', darkTextureSource: 'video' },
        ]),
        copyJson: JSON.stringify([
          { id: 'u1', title: 'One', text: 'First' },
          { id: '', title: 'skip' },
          { id: 'u2', title: 3 },
        ]),
        playback: 'autoplay',
        transition: 'linear',
        textureSize: '32',
        textColorSource: 'custom',
        darkTextColorSource: 'custom',
      },
      [
        { playback: 'manual' },
        { textureSize: '256' },
        { unitsJson: [] },
        { unitsJson: 'not json' },
        { copyJson: '{}' },
      ],
    ),
  ]),
  schemaCase('features/page/blocks immersive-scene immersiveSceneUnitVisualSchema', immersiveSceneUnitVisualSchema, [
    { id: 'u' },
    { id: '', mesh: 'box' },
    { id: 'u', mesh: 'pyramid', meshSource: 'file', meshOptimizationMethod: 'draco' },
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('features/page/blocks immersive-scene immersiveSceneUnitCopySchema', immersiveSceneUnitCopySchema, [
    { id: 'u' },
    { id: 'u', title: 't', text: 'x' },
    { id: '' },
    ...COMMON_BAD_INPUTS,
  ]),

  // Collaboration documents.
  schemaCase('lib/collab FormFieldsSchema', FormFieldsSchema, [
    { title: 'Form', schema: validFormSchemaValue },
    { title: 'Form', schema: { id: 'x' } },
    { title: 1, schema: { id: 'x', steps: [] } },
    ...COMMON_BAD_INPUTS,
  ]),
  schemaCase('lib/collab CampaignFieldsSchema', CampaignFieldsSchema, [
    { targetMode: CampaignTargetMode.ALL, segmentId: null, layoutId: null, recipientScope: 'SUBSCRIBED_USERS' },
    { targetMode: CampaignTargetMode.SEGMENT, segmentId: 's', layoutId: 'l', recipientScope: 'ALL_MATCHING_USERS' },
    { targetMode: CampaignTargetMode.UNSPECIFIED, segmentId: null, layoutId: null, recipientScope: 'SUBSCRIBED_USERS' },
    { targetMode: CampaignTargetMode.ALL, segmentId: undefined, layoutId: null, recipientScope: 'EVERYONE' },
    ...COMMON_BAD_INPUTS,
  ]),
  functionCase(
    'lib/collab TypedMetaMap get/set',
    (value) => {
      const document = new Y.Doc();
      const map = new TypedMetaMap(document.getMap<unknown>('fields'), FormFieldsSchema, new Set(['schema'] as const));
      const input = value as { title: unknown; schema: unknown; raw?: unknown };
      const setTitle = map.set('title', input.title as string);
      const setMany = map.setMany({ schema: input.schema as never });
      if (input.raw !== undefined) {
        document.getMap<unknown>('fields').set('schema', input.raw);
      }
      const result = {
        setTitle,
        setMany,
        all: map.getAll(),
        withDefaults: map.getAllWithDefaults({ title: 'd', schema: { id: '', steps: [] } }),
      };
      document.destroy();
      return result;
    },
    [
      { title: 'T', schema: { id: 'x', steps: [] } },
      { title: 3, schema: { id: 'x' } },
      { title: 'T', schema: { id: 'x', steps: [] }, raw: '{"id":"y","steps":[]}' },
      { title: 'T', schema: { id: 'x', steps: [] }, raw: '{broken' },
      { title: 'T', schema: { id: 'x', steps: [] }, raw: '{"id":1}' },
    ],
  ),
  functionCase(
    'lib/collab parseBlockRoomBootstrap',
    (overrides) => {
      const result = parseBlockRoomBootstrap(
        bootstrapPayload(overrides as Record<string, unknown>),
        'post',
        UUID,
        'ko',
      );
      return {
        documentName: result.documentName,
        metadataSequence: result.metadataSequence,
        sourceMetadata: result.sourceMetadata,
        localeMetadata: result.localeMetadata,
        targetRevision: result.targetRevision,
      };
    },
    BOOTSTRAP_OVERRIDES,
  ),

  // Upload session storage.
  functionCase(
    'lib/upload readUploadSession',
    (stored) => withStorage({ 'geul-upload-session:file-x': stored as string }, () => readUploadSession(' file-x ')),
    [
      JSON.stringify({ fileId: 'file-x', uploadId: ' up ' }),
      JSON.stringify({ fileId: 'file-x', uploadId: 'up', attemptId: '  ', clientMediaBundleId: 'b' }),
      JSON.stringify({ fileId: 'file-x', uploadId: 'up', extra: 1 }),
      JSON.stringify({ fileId: 'file-x' }),
      '{broken',
    ],
  ),
  functionCase(
    'lib/upload rememberUploadSession',
    (session) => withStorage({}, () => rememberUploadSession(session as never)),
    [
      { fileId: 'file-remember', uploadId: 'u' },
      { fileId: '  ', uploadId: 'u' },
      { fileId: 'file-remember-2', uploadId: 'u', attemptId: 3 },
    ],
  ),
  functionCase(
    'lib/upload readDurablePreparedSession',
    (stored) =>
      withStorage({ 'geul-prepared-upload:file-y': JSON.stringify(stored) }, () =>
        readDurablePreparedSession('file-y'),
      ),
    [
      durableUpload,
      { ...durableUpload, sourceStorageId: 'geul-client-media-12345678-1234-1234-1234-123456789abc' },
      { ...durableUpload, sourceStorageId: 'bad namespace!' },
      { ...durableUpload, uploadType: 1.5 },
      { ...durableUpload, progress: { loadedBytes: -1, percentage: 100 } },
      { ...durableUpload, receipts: [{ path: '', sha256: 'XYZ' }] },
      { ...durableUpload, source: { ...durableUpload.source, extra: 1 } },
      { ...durableUpload, extra: 1 },
    ],
  ),

  // Audience segment date picker.
  functionCase('features/admin/segment coerceDateValue', coerceDateValue, [
    '2024-05-06',
    '2024-05-06T10:20:30+09:00',
    new Date('2024-01-02T03:04:05.000Z'),
    new Date(Number.NaN),
    1_700_000_000_000,
    'not a date',
    '',
    0,
    null,
    undefined,
    true,
    {},
    [],
  ]),
];
