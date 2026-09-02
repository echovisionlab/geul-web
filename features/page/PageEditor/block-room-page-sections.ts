import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import {
  contentBlockCatalogFingerprint,
  pageSectionCatalog,
  pageSectionFieldOwnership,
  pageSectionKindByProtoCase,
  type PageSectionKind,
} from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  PageSectionLocaleSchema,
  PageSectionNodeSchema,
  type LocalizedPageDocument,
  type PageSectionLocale,
  type PageSectionNode,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  deleteBlockRoomAtomicValue,
  deleteBlockRoomBaseNode,
  insertPageSectionLocale,
  insertPageSectionNode,
  materializeCanonicalBlockRoom,
  movePageSectionNode,
  observeCanonicalBlockRoom,
  replaceBlockRoomCollaborativeText,
  replaceBlockRoomPayloadArray,
  roomLocaleRole,
  setBlockRoomAtomicValue,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import type * as Y from 'yjs';
import { materializeLocalizedPageSections } from '@/features/editor/contract/localized-page';
import type { SectionMeta, SectionSettings, SectionUpdates } from './types';
import { parseSectionMeta } from '@/features/page/blocks/section-schema';
import { createBlockId } from '@/lib/editor/block-id';

type JsonObject = Record<string, JsonValue>;
type FieldOwnership = 'shared' | 'source' | 'locale';
interface FieldSpec {
  readonly type: string;
  readonly ownership?: FieldOwnership;
  readonly required?: boolean;
  readonly default?: unknown;
  readonly items?: FieldSpec;
  readonly fields?: Readonly<Record<string, FieldSpec>>;
}

const protoCaseByKind = Object.fromEntries(
  Object.entries(pageSectionKindByProtoCase).map(([protoCase, kind]) => [kind, protoCase]),
) as Record<PageSectionKind, keyof typeof pageSectionKindByProtoCase>;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function enumToken(value: string): string {
  const token = value
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .replace(/[^A-Za-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .toUpperCase();
  return /^\d/u.test(token) ? `X_${token}` : token;
}

function enumJsonName(field: string, value: unknown): string {
  const text = String(value);
  if (/^[A-Z][A-Z0-9_]*$/u.test(text)) {
    return text;
  }
  const prefix = `${enumToken(field)}_`;
  return text.startsWith(prefix) ? text : `${prefix}${enumToken(text)}`;
}

function list(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }
  if (value.trim().startsWith('[')) {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('Page section collection must be an array.');
    }
    return parsed;
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeField(field: string, value: unknown, spec: FieldSpec): JsonValue | undefined {
  if (value === undefined || value === null || (value === '' && !spec.required && spec.type !== 'string')) {
    return undefined;
  }
  switch (spec.type) {
    case 'boolean':
      return value === true || value === 'true';
    case 'integer':
    case 'number': {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        throw new Error(`Invalid Page section number: ${field}`);
      }
      return number;
    }
    case 'enum':
      return enumJsonName(field, value);
    case 'enum_int':
      return `${enumToken(field)}_${String(value)}`;
    case 'array':
      return list(value).flatMap((item) => {
        const normalized = spec.items ? normalizeField(`${field}Item`, item, spec.items) : (item as JsonValue);
        return normalized === undefined ? [] : [normalized];
      });
    case 'object':
      return Object.fromEntries(
        Object.entries(spec.fields ?? {}).flatMap(([key, childSpec]) => {
          const normalized = normalizeField(key, record(value)[key], childSpec);
          return normalized === undefined ? [] : [[key, normalized]];
        }),
      );
    default:
      return typeof value === 'string' ? value.trim() : String(value);
  }
}

function normalizedProps(
  kind: PageSectionKind,
  propsValue: Record<string, unknown> | undefined,
  ownership: FieldOwnership,
): JsonObject {
  const input = { ...(propsValue ?? {}) };
  if (kind === 'external-video' && input.url !== undefined) {
    input.uri = input.url;
  }
  if (kind === 'text-marquee' && input.itemsJson !== undefined) {
    input.items = input.itemsJson;
  }
  if (kind === 'map' && input.show3DBuildings !== undefined) {
    input.show3dBuildings = input.show3DBuildings;
  }
  const fields = pageSectionCatalog[kind].fields as Readonly<Record<string, FieldSpec>>;
  return Object.fromEntries(
    Object.entries(fields).flatMap(([field, spec]) => {
      if (pageSectionFieldOwnership(kind, field) !== ownership) {
        return [];
      }
      const value = input[field] ?? spec.default;
      const normalized = normalizeField(field, value, spec);
      return normalized === undefined ? [] : [[field, normalized]];
    }),
  );
}

function settingsJson(settings: SectionSettings | undefined): JsonObject {
  const value: Partial<SectionSettings> = settings ?? {};
  return Object.fromEntries(
    [
      ['backgroundColor', value.backgroundColor],
      ['paddingTop', value.paddingTop === undefined ? undefined : Number(value.paddingTop)],
      ['paddingBottom', value.paddingBottom === undefined ? undefined : Number(value.paddingBottom)],
      ['paddingLeft', value.paddingLeft === undefined ? undefined : Number(value.paddingLeft)],
      ['paddingRight', value.paddingRight === undefined ? undefined : Number(value.paddingRight)],
      ['maxWidth', value.maxWidth ? enumJsonName('maxWidth', value.maxWidth) : undefined],
    ].flatMap(([key, item]) => (item === undefined || item === '' ? [] : [[key, item as JsonValue]])),
  );
}

function immersiveUnits(props: Record<string, unknown> | undefined): JsonValue[] {
  const values = list(props?.unitsJson);
  const numberFields = new Set([
    'scale',
    'meshOffsetY',
    'particleSize',
    'holdSeconds',
    'rotationX',
    'rotationY',
    'rotationZ',
    'rotationSpeedX',
    'rotationSpeedY',
    'rotationSpeedZ',
    'scrollRotationTurnsX',
    'scrollRotationTurnsY',
    'scrollRotationTurnsZ',
  ]);
  const enumFields = new Set(['mesh', 'meshSource', 'textureSource', 'darkTextureSource']);
  return values.map((rawUnit) => {
    const unit = record(rawUnit);
    const unitProps: JsonObject = {};
    for (const [key, value] of Object.entries(unit)) {
      if (key === 'id' || key.endsWith('FileId') || value === undefined || value === '') {
        continue;
      }
      unitProps[key] = numberFields.has(key)
        ? Number(value)
        : enumFields.has(key)
          ? enumJsonName(key, value)
          : (value as JsonValue);
    }
    for (const key of [
      'meshFile',
      'meshOptimizationSourceFile',
      'meshOptimizationFile',
      'textureFile',
      'darkTextureFile',
    ]) {
      const fileId = unit[`${key}Id`];
      if (typeof fileId === 'string' && fileId) {
        unitProps[key] = { activeFileId: fileId };
      }
    }
    return { id: String(unit.id), props: unitProps };
  });
}

function immersiveLocaleUnits(props: Record<string, unknown> | undefined): JsonValue[] {
  return list(props?.copyJson).map((rawUnit) => {
    const unit = record(rawUnit);
    return {
      unitId: String(unit.id),
      props: { title: String(unit.title ?? ''), text: String(unit.text ?? '') },
    };
  });
}

function columnPayload(section: SectionMeta): JsonObject {
  if (section.type !== 'columns') {
    return {};
  }
  const ratios = String(section.props?.columnRatios ?? '')
    .split(':')
    .map(Number);
  return {
    columns: section.columns.map((column, index) => ({
      id: column.id,
      ratio: Number.isFinite(ratios[index]) && ratios[index]! > 0 ? ratios[index]! : 1,
    })),
    gap: Number(section.props?.gap ?? 24),
    mobileStack: section.props?.mobileStack !== 'false',
  };
}

function richTextBase(_sectionId: string): { base: JsonObject; locale: (locale: string) => JsonObject } {
  const blockId = createBlockId();
  return {
    base: {
      props: {},
      blocks: { nodes: [{ block: { id: blockId, paragraph: { props: {} } }, placement: { index: 0 } }] },
    },
    locale: (locale) => ({
      props: {},
      blocks: {
        locale,
        blocks: [{ blockId, paragraph: { props: {}, content: [] } }],
      },
    }),
  };
}

function payloads(section: SectionMeta): {
  base: JsonObject;
  locale: (locale: string, active: boolean) => JsonObject;
} {
  if (section.type === 'rich-text') {
    return richTextBase(section.id);
  }
  if (section.type === 'columns') {
    return { base: { props: columnPayload(section) }, locale: () => ({ props: {} }) };
  }
  const baseProps = normalizedProps(section.type, section.props, 'shared');
  const sourceProps = normalizedProps(section.type, section.props, 'source');
  const localeProps = normalizedProps(section.type, section.props, 'locale');
  const base: JsonObject = { props: { ...baseProps, ...sourceProps } };
  if (section.type === 'immersive-scene') {
    base.units = immersiveUnits(section.props);
  }
  return {
    base,
    locale: (_locale, active) => ({
      props: active ? localeProps : {},
      ...(section.type === 'immersive-scene' ? { units: active ? immersiveLocaleUnits(section.props) : [] } : {}),
    }),
  };
}

function toSectionMeta(section: ReturnType<typeof materializeLocalizedPageSections>[number]): SectionMeta {
  return parseSectionMeta({
    id: section.id,
    type: section.kind,
    settings: section.settings,
    props: section.props,
    ...(section.kind === 'columns'
      ? {
          columns: section.columns.map((column) => ({
            id: column.id,
            sections: column.sections.map(toSectionMeta),
          })),
        }
      : {}),
  });
}

function pageDocument(document: Y.Doc): LocalizedPageDocument {
  const value = materializeCanonicalBlockRoom(document, 'page');
  if (value.$typeName !== 'api.content.v1.LocalizedPageDocument') {
    throw new Error('Expected a typed localized Page document.');
  }
  return value;
}

function readSections(document: Y.Doc, locale: string): SectionMeta[] {
  const localized = pageDocument(document);
  if (localized.locale !== locale) {
    throw new Error(`Page room locale mismatch: expected ${locale}, received ${localized.locale}.`);
  }
  return materializeLocalizedPageSections(localized).map(toSectionMeta);
}

function findSection(sections: readonly SectionMeta[], id: string): SectionMeta | null {
  for (const section of sections) {
    if (section.id === id) {
      return section;
    }
    if (section.type === 'columns') {
      for (const column of section.columns) {
        const child = findSection(column.sections, id);
        if (child) {
          return child;
        }
      }
    }
  }
  return null;
}

function replaceText(
  document: Y.Doc,
  ref: Parameters<typeof replaceBlockRoomCollaborativeText>[1],
  value: string,
): void {
  replaceBlockRoomCollaborativeText(document, ref, value, { origin: 'page-section-adapter' });
}

export class BlockRoomPageSectionsController {
  constructor(
    readonly document: Y.Doc,
    readonly locale: string,
  ) {}

  read(): SectionMeta[] {
    return readSections(this.document, this.locale);
  }

  observe(listener: (sections: readonly SectionMeta[]) => void): () => void {
    return observeCanonicalBlockRoom(this.document, 'page', () => listener(this.read()));
  }

  insert(section: SectionMeta, placement: { parentSectionId?: string; columnId?: string; index: number }): void {
    this.#assertStructuralAuthority();
    const protoCase = protoCaseByKind[section.type];
    const generated = payloads(section);
    const node = fromJson(PageSectionNodeSchema, {
      section: {
        id: section.id,
        settings: settingsJson(section.settings),
        [protoCase]: generated.base,
      },
      placement,
    } as JsonValue) as PageSectionNode;
    this.document.transact(() => {
      insertPageSectionNode(this.document, node, { origin: 'page-section-adapter' });
      const localized = fromJson(PageSectionLocaleSchema, {
        sectionId: section.id,
        [protoCase]: generated.locale(this.locale, true),
      } as JsonValue) as PageSectionLocale;
      insertPageSectionLocale(this.document, localized, { origin: 'page-section-adapter' });
      if (section.type === 'columns') {
        section.columns.forEach((column) => {
          column.sections.forEach((child, index) => {
            this.insert(child, { parentSectionId: section.id, columnId: column.id, index });
          });
        });
      }
    }, 'page-section-adapter');
  }

  delete(sectionId: string): void {
    this.#assertStructuralAuthority();
    deleteBlockRoomBaseNode(this.document, sectionId, { origin: 'page-section-adapter' });
  }

  move(sectionId: string, placement: { parentSectionId?: string; columnId?: string; index: number }): void {
    this.#assertStructuralAuthority();
    movePageSectionNode(this.document, sectionId, placement, { origin: 'page-section-adapter' });
  }

  update(sectionId: string, updates: SectionUpdates): void {
    this.#assertStructuralAuthority();
    const before = findSection(this.read(), sectionId);
    if (!before) {
      throw new Error(`Unknown Page section: ${sectionId}`);
    }
    if (updates.settings) {
      this.#updateSettings(sectionId, updates.settings);
    }
    if (updates.props) {
      this.document.transact(() => {
        this.#updateProps(sectionId, before.type, updates.props!, 'shared');
        this.#updateProps(sectionId, before.type, updates.props!, 'source');
      }, 'page-section-adapter');
    }
    if (updates.columns && before.type === 'columns') {
      const next = parseSectionMeta({ ...before, columns: updates.columns });
      if (next.type !== 'columns') {
        throw new Error('Expected a Columns Page section.');
      }
      this.document.transact(() => {
        const beforeChildren = new Map(
          before.columns.flatMap((column) => column.sections.map((child) => [child.id, child] as const)),
        );
        const nextChildren = new Map(
          next.columns.flatMap((column) => column.sections.map((child) => [child.id, child] as const)),
        );
        for (const childId of beforeChildren.keys()) {
          if (!nextChildren.has(childId)) {
            this.delete(childId);
          }
        }
        this.#replaceBaseArray(sectionId, 'props.columns', columnPayload(next).columns as JsonValue[]);
        next.columns.forEach((column) => {
          column.sections.forEach((child, index) => {
            if (beforeChildren.has(child.id)) {
              this.move(child.id, { parentSectionId: sectionId, columnId: column.id, index });
            } else {
              this.insert(child, { parentSectionId: sectionId, columnId: column.id, index });
            }
          });
        });
      }, 'page-section-adapter');
    }
  }

  updateLocaleProps(sectionId: string, props: Record<string, unknown>): void {
    const section = findSection(this.read(), sectionId);
    if (!section) {
      throw new Error(`Unknown Page section: ${sectionId}`);
    }
    this.#updateProps(sectionId, section.type, props, 'locale');
  }

  #updateSettings(sectionId: string, updates: Partial<SectionSettings>): void {
    const values = settingsJson(updates as SectionSettings);
    for (const field of ['backgroundColor', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'maxWidth']) {
      if (!(field in updates)) {
        continue;
      }
      const ref = { family: 'page_section' as const, id: sectionId, path: `settings.${field}` };
      const value = values[field];
      if (value === undefined) {
        try {
          deleteBlockRoomAtomicValue(this.document, ref, { origin: 'page-section-adapter' });
        } catch {
          /* absent */
        }
      } else {
        setBlockRoomAtomicValue(this.document, ref, value as string | number | boolean | null, {
          origin: 'page-section-adapter',
        });
      }
    }
  }

  #updateProps(
    sectionId: string,
    kind: PageSectionKind,
    props: Record<string, unknown>,
    ownership: FieldOwnership,
  ): void {
    if (kind === 'immersive-scene' && ownership === 'shared' && props.unitsJson !== undefined) {
      this.#replaceBaseArray(sectionId, 'units', immersiveUnits(props));
    }
    if (kind === 'immersive-scene' && ownership === 'locale' && props.copyJson !== undefined) {
      replaceBlockRoomPayloadArray(
        this.document,
        {
          family: 'page_section',
          id: sectionId,
          locale: true,
          path: 'units',
        },
        immersiveLocaleUnits(props),
        { origin: 'page-section-adapter' },
      );
    }
    const normalized = normalizedProps(kind, props, ownership);
    const fields = pageSectionCatalog[kind].fields as Readonly<Record<string, FieldSpec>>;
    for (const field of Object.keys(props)) {
      const canonicalField =
        kind === 'external-video' && field === 'url'
          ? 'uri'
          : kind === 'text-marquee' && field === 'itemsJson'
            ? 'items'
            : kind === 'map' && field === 'show3DBuildings'
              ? 'show3dBuildings'
              : field;
      if (!fields[canonicalField] || pageSectionFieldOwnership(kind, canonicalField) !== ownership) {
        continue;
      }
      const value = normalized[canonicalField];
      const ref = {
        family: 'page_section' as const,
        id: sectionId,
        ...(ownership === 'locale' ? { locale: true as const } : {}),
        path: `props.${canonicalField}`,
      };
      if (Array.isArray(value)) {
        replaceBlockRoomPayloadArray(this.document, ref, value, { origin: 'page-section-adapter' });
      } else if (ownership === 'locale' && fields[canonicalField]?.type === 'string') {
        replaceText(this.document, ref, String(value ?? ''));
      } else if (value === undefined) {
        try {
          deleteBlockRoomAtomicValue(this.document, ref, { origin: 'page-section-adapter' });
        } catch {
          // Clearing an already-absent optional field is an idempotent no-op.
        }
      } else if (value !== undefined) {
        setBlockRoomAtomicValue(this.document, ref, value as string | number | boolean | null, {
          origin: 'page-section-adapter',
        });
      }
    }
  }

  #replaceBaseArray(sectionId: string, path: string, values: readonly JsonValue[]): void {
    replaceBlockRoomPayloadArray(
      this.document,
      {
        family: 'page_section',
        id: sectionId,
        path,
      },
      values,
      { origin: 'page-section-adapter' },
    );
  }

  #assertStructuralAuthority(): void {
    if (roomLocaleRole(this.document) !== 'source') {
      throw new Error('Page target locale rooms cannot mutate shared section structure.');
    }
  }
}

export function createBlockRoomPageSectionsController(
  document: Y.Doc,
  locale: string,
): BlockRoomPageSectionsController {
  const canonical = pageDocument(document);
  if (canonical.blockCatalogFingerprint !== contentBlockCatalogFingerprint) {
    throw new Error('Page Block catalog fingerprint mismatch.');
  }
  if (canonical.locale !== locale) {
    throw new Error(`Page locale room is not resident: ${locale}`);
  }
  return new BlockRoomPageSectionsController(document, locale);
}
