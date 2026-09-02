import { create, toJson } from '@bufbuild/protobuf';
import {
  contentBlockCatalogFingerprint,
  pageImmersiveUnitCatalog,
  pageSectionCatalog,
  pageSectionKindByProtoCase,
  validateLocalizedPageDocument,
  type PageSectionKind,
} from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  PageSectionSchema,
  PageSectionLocaleSchema,
  PageSectionSettings_MaxWidth,
  RichTextProfile,
  type LocalizedPageDocument,
  type PageSection,
  type PageSectionLocale,
  type PageSectionSettings,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { materializeLocalizedRichTextTree, type LocalizedRichTextBlock } from './localized-rich-text';

type JsonRecord = Record<string, unknown>;

export interface LocalizedPageColumn {
  id: string;
  ratio: number;
  sections: LocalizedPageSection[];
}

export interface LocalizedPageSection {
  id: string;
  kind: PageSectionKind;
  settings: {
    backgroundColor?: string;
    paddingTop?: string;
    paddingBottom?: string;
    paddingLeft?: string;
    paddingRight?: string;
    maxWidth?: 'full' | 'container' | 'narrow';
  };
  props: Record<string, unknown>;
  richText: readonly LocalizedRichTextBlock[] | null;
  columns: LocalizedPageColumn[];
}

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function enumToken(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function legacyEnum(value: unknown, values: readonly unknown[] | undefined): unknown {
  if (typeof value !== 'string' || !values) {
    return value;
  }
  const match = values.find((candidate) => {
    const token = enumToken(String(candidate));
    return value === token || value.endsWith(`_${token}`);
  });
  return match ?? value;
}

interface FieldSpec {
  type?: string;
  values?: readonly unknown[];
  items?: FieldSpec;
  fields?: Readonly<Record<string, FieldSpec>>;
}

function legacyScalar(value: unknown, spec: FieldSpec | undefined): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (spec?.type === 'enum' || spec?.type === 'enum_int') {
    return String(legacyEnum(value, spec.values));
  }
  if (spec?.type === 'array') {
    if (!Array.isArray(value)) {
      return String(value);
    }
    if (spec.items?.type === 'object') {
      return JSON.stringify(value.map((item) => legacyObject(record(item), spec.items?.fields)));
    }
    return value.map((item) => legacyScalar(item, spec.items)).join(',');
  }
  if (spec?.type === 'object') {
    return legacyObject(record(value), spec.fields);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return value;
}

function legacyObject(value: JsonRecord, fields: Readonly<Record<string, FieldSpec>> | undefined): JsonRecord {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => key !== '$typeName' && item !== undefined && item !== null)
      .map(([key, item]) => [key, legacyScalar(item, fields?.[key])]),
  );
}

function payloadJson(section: PageSection | PageSectionLocale): JsonRecord {
  if (section.$typeName === 'api.content.v1.PageSection') {
    const json = record(toJson(PageSectionSchema, section));
    return record(json[section.value.case ?? '']);
  }
  const json = record(toJson(PageSectionLocaleSchema, section));
  return record(json[section.value.case ?? '']);
}

function legacyProps(kind: PageSectionKind, base: PageSection, localized: PageSectionLocale | undefined): JsonRecord {
  const catalog = pageSectionCatalog[kind] as { fields: Readonly<Record<string, FieldSpec>> };
  const basePayload = payloadJson(base);
  const localePayload = localized ? payloadJson(localized) : {};
  const props = legacyObject({ ...record(basePayload.props), ...record(localePayload.props) }, catalog.fields);

  if (kind === 'external-video') {
    props.url = props.uri;
    delete props.uri;
  }
  if (kind === 'post-list' && props.showImage !== undefined) {
    props.showFeaturedImage = props.showImage;
  }
  if (kind === 'text-marquee' && props.items !== undefined) {
    props.itemsJson = props.items;
    delete props.items;
  }
  if (kind === 'map' && props.show3dBuildings !== undefined) {
    props.show3DBuildings = props.show3dBuildings;
  }
  if (kind === 'immersive-scene') {
    const baseUnits = Array.isArray(basePayload.units) ? basePayload.units.map(record) : [];
    const localeUnits = new Map(
      (Array.isArray(localePayload.units) ? localePayload.units.map(record) : []).map((unit) => [
        String(unit.unitId ?? ''),
        unit,
      ]),
    );
    const visualUnits = baseUnits.map((unit) => {
      const visual = legacyObject({ id: unit.id, ...record(unit.props) }, pageImmersiveUnitCatalog);
      for (const key of [
        'meshFile',
        'meshOptimizationSourceFile',
        'meshOptimizationFile',
        'textureFile',
        'darkTextureFile',
      ]) {
        const attachment = record(visual[key]);
        if (attachment.activeFileId) {
          visual[`${key}Id`] = attachment.activeFileId;
        }
        delete visual[key];
      }
      return visual;
    });
    const copyUnits = baseUnits.map((unit) => {
      const id = String(unit.id ?? '');
      const translated = record(localeUnits.get(id)?.props);
      return { id, title: translated.title ?? '', text: translated.text ?? '' };
    });
    props.unitsJson = JSON.stringify(visualUnits);
    props.copyJson = JSON.stringify(copyUnits);
  }
  if (kind === 'columns') {
    const columns = Array.isArray(basePayload.props)
      ? basePayload.props.map(record)
      : Array.isArray(record(basePayload.props).columns)
        ? (record(basePayload.props).columns as unknown[]).map(record)
        : [];
    props.columns = String(columns.length || 2);
    props.columnRatios = columns.map((column) => String(column.ratio ?? 1)).join(':') || '1:1';
    delete props.columnsJson;
  }
  return props;
}

function sectionSettings(settings: PageSectionSettings | undefined): LocalizedPageSection['settings'] {
  const maxWidth =
    settings?.maxWidth === PageSectionSettings_MaxWidth.CONTAINER
      ? 'container'
      : settings?.maxWidth === PageSectionSettings_MaxWidth.NARROW
        ? 'narrow'
        : settings?.maxWidth === PageSectionSettings_MaxWidth.FULL
          ? 'full'
          : undefined;
  return {
    backgroundColor: settings?.backgroundColor,
    paddingTop: settings?.paddingTop === undefined ? undefined : String(settings.paddingTop),
    paddingBottom: settings?.paddingBottom === undefined ? undefined : String(settings.paddingBottom),
    paddingLeft: settings?.paddingLeft === undefined ? undefined : String(settings.paddingLeft),
    paddingRight: settings?.paddingRight === undefined ? undefined : String(settings.paddingRight),
    maxWidth,
  };
}

export function materializeLocalizedPageSections(document: LocalizedPageDocument): LocalizedPageSection[] {
  validateLocalizedPageDocument(document);
  if (document.blockCatalogFingerprint !== contentBlockCatalogFingerprint) {
    throw new Error('Page document block catalog fingerprint does not match the runtime catalog.');
  }

  const nodes = document.base?.nodes ?? [];
  const localeBySectionId = new Map(
    (document.localeOverlay?.sections ?? []).map((section) => [section.sectionId, section]),
  );
  const nodeById = new Map(nodes.flatMap((node) => (node.section ? [[node.section.id, node] as const] : [])));
  const children = new Map<string, typeof nodes>();
  for (const node of nodes) {
    const parentId = node.placement?.parentSectionId;
    const columnId = node.placement?.columnId;
    if (!parentId || !columnId) {
      continue;
    }
    const key = `${parentId}:${columnId}`;
    const list = children.get(key) ?? [];
    list.push(node);
    children.set(key, list);
  }

  const materialize = (id: string): LocalizedPageSection => {
    const node = nodeById.get(id);
    const section = node?.section;
    if (!section || section.value.case === undefined) {
      throw new Error(`Page section ${id} is incomplete.`);
    }
    const kind = pageSectionKindByProtoCase[section.value.case];
    const localized = localeBySectionId.get(id);
    const richText =
      section.value.case === 'richText'
        ? materializeLocalizedRichTextTree(
            create(LocalizedRichTextDocumentSchema, {
              blockCatalogFingerprint: document.blockCatalogFingerprint,
              profile: RichTextProfile.PAGE,
              locale: document.locale,
              base: section.value.value.blocks,
              localeOverlay: localized?.value.case === 'richText' ? localized.value.value.blocks : undefined,
            }),
          )
        : null;
    const columns =
      section.value.case === 'columns'
        ? (section.value.value.props?.columns ?? []).map((column) => ({
            id: column.id,
            ratio: column.ratio,
            sections: (children.get(`${id}:${column.id}`) ?? [])
              .sort((a, b) => (a.placement?.index ?? 0) - (b.placement?.index ?? 0))
              .flatMap((child) => (child.section ? [materialize(child.section.id)] : [])),
          }))
        : [];
    return {
      id,
      kind,
      settings: sectionSettings(section.settings),
      props: legacyProps(kind, section, localized),
      richText,
      columns,
    };
  };

  return nodes
    .filter((node) => !node.placement?.parentSectionId && node.section)
    .sort((a, b) => (a.placement?.index ?? 0) - (b.placement?.index ?? 0))
    .flatMap((node) => (node.section ? [materialize(node.section.id)] : []));
}
