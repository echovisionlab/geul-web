import { canLinkSiteVariable } from '@/lib/site-variables';
import type { JSONContent } from '@tiptap/core';
import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import {
  isSiteVariableKey,
  richTextBlockFieldOwnership,
  richTextBlockKindByProtoCase,
  richTextBlockCatalog,
  type RichTextBlockKind,
} from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  RichTextBlockDataSchema,
  RichTextBlockLocaleDataSchema,
  type RichTextBlockData,
  type RichTextBlockLocaleData,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { resolveExternalVideo } from '@/lib/media/external-video';
import { isBlockId } from '@/lib/editor/block-id';
import type { ProseMirrorBlockDescriptor } from './block-room-prosemirror-bridge';
import { richTextProseMirrorAdapterForProtoCase } from './block-room-prosemirror-registry';
import { SHADER_STAGE_DEFINITIONS } from './shader/shader-program';
import { emojiTextForName } from './emoji/emoji-runtime';

export type JsonObject = Readonly<Record<string, JsonValue>>;
type TiptapMark = NonNullable<JSONContent['marks']>[number];
export type CatalogFieldSpec = Readonly<{
  type: string;
  default?: unknown;
  values?: readonly (string | number)[];
  items?: CatalogFieldSpec;
  fields?: Readonly<Record<string, CatalogFieldSpec>>;
}>;

const TABLE_CELL_FIELDS: Readonly<Record<string, CatalogFieldSpec>> = {
  colspan: { type: 'integer', default: 1 },
  rowspan: { type: 'integer', default: 1 },
  backgroundColor: { type: 'editor_color', default: 'default' },
  textColor: { type: 'editor_color', default: 'default' },
  textAlignment: { type: 'enum', default: 'left', values: ['left', 'center', 'right'] },
};

export interface TiptapBlockSnapshot {
  readonly id: string;
  readonly nodeType: string;
  readonly protoCase: keyof typeof richTextBlockKindByProtoCase;
  readonly kind: RichTextBlockKind;
  readonly parentBlockId?: string;
  readonly index: number;
  readonly attrs: JsonObject;
  readonly content: readonly JSONContent[];
  readonly children: readonly TiptapBlockSnapshot[];
}

export interface TiptapBlockRoomProjectionOptions {
  readonly paragraphExternalVideo: boolean;
}

const EXTERNAL_VIDEO_DISABLED: TiptapBlockRoomProjectionOptions = { paragraphExternalVideo: false };

export function object(value: JsonValue | undefined): JsonObject {
  return value && !Array.isArray(value) && typeof value === 'object' ? value : {};
}

export function array(value: JsonValue | undefined): readonly JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function jsonAttributes(value: Record<string, unknown> | undefined): JsonObject {
  return Object.fromEntries(
    Object.entries(value ?? {}).filter((entry): entry is [string, JsonValue] => {
      const item = entry[1];
      return (
        item === null ||
        typeof item === 'string' ||
        typeof item === 'number' ||
        typeof item === 'boolean' ||
        Array.isArray(item) ||
        (typeof item === 'object' && item !== null)
      );
    }),
  );
}

function enumToken(value: string | number): string {
  const normalized = String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .toUpperCase();
  // Numeric catalog enums (Heading Level) use LEVEL_2 in protobuf JSON.
  // String enums such as "4:3" use the generated X_4_3 identifier.
  return typeof value === 'string' && /^[0-9]/.test(normalized) ? `X_${normalized}` : normalized;
}

export function decodeCatalogValue(spec: CatalogFieldSpec, value: JsonValue): JsonValue {
  if ((spec.type === 'enum' || spec.type === 'enum_int') && spec.values) {
    if (typeof value === 'number') {
      return (spec.values[value - 1] ?? spec.default ?? value) as JsonValue;
    }
    if (typeof value === 'string') {
      const candidate = spec.values.find((item) => value.endsWith(`_${enumToken(item)}`));
      return (candidate ?? spec.default ?? value) as JsonValue;
    }
  }
  if (spec.type === 'array' && spec.items && Array.isArray(value)) {
    return value.map((item) => decodeCatalogValue(spec.items!, item));
  }
  if (spec.type === 'object' && spec.fields && value && !Array.isArray(value) && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([field, item]) => [
        field,
        spec.fields?.[field] ? decodeCatalogValue(spec.fields[field]!, item) : item,
      ]),
    );
  }
  return value;
}

function encodeCatalogValue(spec: CatalogFieldSpec, value: JsonValue): JsonValue {
  if ((spec.type === 'enum' || spec.type === 'enum_int') && spec.values) {
    const index = spec.values.findIndex((candidate) => candidate === value);
    if (index < 0) {
      throw new Error(`Unsupported generated enum value: ${String(value)}`);
    }
    return index + 1;
  }
  if (spec.type === 'array' && spec.items && Array.isArray(value)) {
    return value.map((item) => encodeCatalogValue(spec.items!, item));
  }
  if (spec.type === 'object' && spec.fields && value && !Array.isArray(value) && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([field, item]) => [
        field,
        spec.fields?.[field] ? encodeCatalogValue(spec.fields[field]!, item) : item,
      ]),
    );
  }
  return value;
}

function blockPropsToTiptap(kind: RichTextBlockKind, payload: JsonObject | undefined): JsonObject {
  const fields = richTextBlockCatalog[kind].fields as Readonly<Record<string, CatalogFieldSpec>>;
  const props = Object.fromEntries(
    Object.entries(object(payload?.props)).map(([field, value]) => [
      field,
      fields[field] ? decodeCatalogValue(fields[field]!, value) : value,
    ]),
  );
  if (kind === 'file' && Object.hasOwn(props, 'attachment')) {
    const attachment = object(props.attachment);
    props.fileId = typeof attachment.activeFileId === 'string' ? attachment.activeFileId : '';
    if (!Object.hasOwn(attachment, 'missingAttachment')) {
      delete props.attachment;
    }
  }
  if (kind === 'paragraph' && Object.hasOwn(props, 'linkThumbnail')) {
    props.linkThumbnailFileId = attachmentToTiptap(props.linkThumbnail);
    delete props.linkThumbnail;
  }
  if (kind === 'map' && Array.isArray(props.mapPlaceIds)) {
    props.mapPlaceIds = props.mapPlaceIds.join(',');
  }
  if (kind === 'p5-sketch' && Array.isArray(props.capabilities)) {
    props.capabilities = props.capabilities.join(' ');
  }
  if (
    kind === 'code-block' ||
    kind === 'file' ||
    kind === 'map' ||
    kind === 'p5-sketch' ||
    kind === 'three-scene' ||
    kind === 'shader'
  ) {
    for (const [field, value] of Object.entries(props)) {
      const spec = fields[field];
      if (spec && ['boolean', 'integer', 'number'].includes(spec.type)) {
        props[field] = String(value);
      }
    }
  }
  if (kind === 'map' && Object.hasOwn(props, 'show3dBuildings')) {
    props.show3DBuildings = String(props.show3dBuildings);
    delete props.show3dBuildings;
  }
  delete props.source;
  delete props.stages;
  return props;
}

function attachmentToTiptap(value: JsonValue | undefined): string {
  const attachment = object(value);
  return typeof attachment.activeFileId === 'string' ? attachment.activeFileId : '';
}

function shaderChannelsToTiptap(value: JsonValue | undefined): JsonValue[] {
  return array(value).map((entry) => {
    const channel = { ...object(entry) };
    if (channel.file) {
      const fileId = attachmentToTiptap(channel.file);
      if (fileId) {
        channel.fileId = fileId;
        delete channel.file;
      }
    }
    if (Array.isArray(channel.faces)) {
      const fileIds = channel.faces.map((face) => attachmentToTiptap(face));
      if (fileIds.every(Boolean)) {
        channel.fileIds = fileIds;
        delete channel.faces;
      }
    }
    return channel;
  });
}

function shaderToTiptap(base: JsonObject): readonly JSONContent[] {
  const fields = richTextBlockCatalog.shader.fields as Readonly<Record<string, CatalogFieldSpec>>;
  const stages = array(decodeCatalogValue(fields.stages!, object(base.props).stages)).map((stage) => object(stage));
  return SHADER_STAGE_DEFINITIONS.map(([kind, nodeType]) => {
    const stage = stages.find(
      (candidate) => candidate.kind === kind || String(candidate.kind).endsWith(`_${enumToken(kind)}`),
    );
    const source = typeof stage?.source === 'string' ? stage.source : '';
    return {
      type: nodeType,
      attrs: stage?.channels ? { channels: shaderChannelsToTiptap(stage.channels) } : undefined,
      content: source ? [{ type: 'text', text: source }] : [],
    };
  });
}

function tableCellPropsToTiptap(payload: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(payload).map(([field, value]) => [
      field,
      TABLE_CELL_FIELDS[field] ? decodeCatalogValue(TABLE_CELL_FIELDS[field]!, value) : value,
    ]),
  );
}

function styleMarks(styles: JsonObject): TiptapMark[] {
  const marks: TiptapMark[] = [];
  for (const name of ['bold', 'italic', 'underline', 'strike', 'code'] as const) {
    if (styles[name] === true) {
      marks.push({ type: name });
    }
  }
  if (typeof styles.textColor === 'string') {
    marks.push({ type: 'textColor', attrs: { stringValue: styles.textColor } });
  }
  if (typeof styles.backgroundColor === 'string') {
    marks.push({ type: 'backgroundColor', attrs: { stringValue: styles.backgroundColor } });
  }
  return marks;
}

function styledText(value: JsonObject, extraMarks: readonly TiptapMark[] = []): JSONContent[] {
  const text = typeof value.text === 'string' ? value.text : '';
  const marks = [...styleMarks(object(value.styles)), ...extraMarks];
  // Imported and collaborative text may contain literal newlines. Project them
  // as explicit breaks so the editor's HTML matches its visible lines.
  return text
    .split(/\r\n|\r|\n/)
    .flatMap((line, index) => [
      ...(index > 0 ? [{ type: 'hardBreak' }] : []),
      ...(line ? [{ type: 'text', text: line, marks }] : []),
    ]);
}

function inlineToTiptap(value: JsonValue): readonly JSONContent[] {
  const inline = object(value);
  if (inline.text) {
    return styledText(object(inline.text));
  }
  if (inline.siteVariable) {
    const variable = object(inline.siteVariable);
    if (
      typeof variable.key !== 'string' ||
      !isSiteVariableKey(variable.key) ||
      (variable.linked === true && !canLinkSiteVariable(variable.key))
    ) {
      throw new Error('Invalid site variable.');
    }
    return [
      {
        type: 'siteVariable',
        attrs: { key: variable.key, linked: variable.linked === true },
        marks: styleMarks(object(variable.styles)),
      },
    ];
  }
  if (inline.hardBreak) {
    return [{ type: 'hardBreak' }];
  }
  if (inline.mathInline) {
    const source = object(inline.mathInline).source;
    return [
      { type: 'mathInline', content: typeof source === 'string' && source ? [{ type: 'text', text: source }] : [] },
    ];
  }
  if (inline.link) {
    const link = object(inline.link);
    const href = typeof link.href === 'string' ? link.href : '';
    return array(link.content).flatMap((text) => {
      return styledText(object(text), [{ type: 'link', attrs: { href } }]);
    });
  }
  throw new Error('Unsupported generated rich-text inline payload.');
}

/** The single link a standalone paragraph holds; card and video projections both present it. */
function standaloneLinkSource(
  content: readonly JSONContent[],
): { readonly url: string; readonly label: string } | null {
  let url: string | null = null;
  let hasLinkedText = false;
  for (const node of content) {
    if (node.type !== 'text') {
      return null;
    }
    const text = node.text ?? '';
    const link = node.marks?.find((mark) => mark.type === 'link');
    if (!text.trim()) {
      if (link) {
        const candidate = typeof link.attrs?.href === 'string' ? link.attrs.href.trim() : '';
        if (!candidate || (url && url !== candidate)) {
          return null;
        }
        url = candidate;
      }
      continue;
    }
    if (!link) {
      return null;
    }
    const candidate = typeof link.attrs?.href === 'string' ? link.attrs.href.trim() : '';
    if (!candidate || (url && url !== candidate)) {
      return null;
    }
    url = candidate;
    hasLinkedText = true;
  }
  if (!url || !hasLinkedText) {
    return null;
  }
  return {
    url,
    label:
      content
        .map((node) => node.text ?? '')
        .join('')
        .trim() || url,
  };
}

/**
 * Chooses the editor-only atom for a standalone link paragraph. An explicit
 * link keeps the paragraph; `auto` keeps the earlier URL-based video detection.
 */
export function linkPresentationNodeType(presentation: unknown, url: string): 'externalVideo' | 'linkCard' | null {
  if (presentation === 'card') {
    return 'linkCard';
  }
  if (
    (presentation === 'video' || presentation === 'auto' || presentation === undefined) &&
    resolveExternalVideo(url)
  ) {
    return 'externalVideo';
  }
  return null;
}

function requireTableIdentity(value: unknown, description: string): string {
  if (!isBlockId(value)) {
    throw new Error(`Generated table ${description} must have durable UUID identities.`);
  }
  return value;
}

function tableToTiptap(base: JsonObject, locale: JsonObject): readonly JSONContent[] {
  const baseRows = array(object(base.content).rows);
  const columnWidths = array(object(base.content).columnWidths);
  const localeRows = array(object(locale.content).rows);
  const resolvedBaseRows = baseRows.map((baseRow) => {
    const row = object(baseRow);
    return {
      rowId: requireTableIdentity(row.id, 'base row'),
      cells: array(row.cells).map((baseCell) => {
        const cell = object(baseCell);
        return {
          cell,
          cellId: requireTableIdentity(cell.id, 'base cell'),
        };
      }),
    };
  });
  const baseRowIds = new Set<string>();
  const baseCellIds = new Set<string>();
  for (const row of resolvedBaseRows) {
    if (baseRowIds.has(row.rowId)) {
      throw new Error('Generated table base contains a missing or duplicate durable row ID.');
    }
    baseRowIds.add(row.rowId);
    for (const cell of row.cells) {
      if (baseCellIds.has(cell.cellId)) {
        throw new Error(`Generated table base row ${row.rowId} contains a missing or duplicate durable cell ID.`);
      }
      baseCellIds.add(cell.cellId);
    }
  }

  const localeByRowId = new Map<string, JsonObject>();
  for (const value of localeRows) {
    const row = object(value);
    const rowId = requireTableIdentity(row.rowId, 'locale row');
    if (localeByRowId.has(rowId)) {
      throw new Error('Generated table locale contains a missing or duplicate durable row ID.');
    }
    localeByRowId.set(rowId, row);
  }
  if (localeByRowId.size !== resolvedBaseRows.length) {
    throw new Error('Generated table base and locale durable row sets do not match.');
  }

  return resolvedBaseRows.map(({ rowId, cells }) => {
    const localeRow = localeByRowId.get(rowId);
    if (!localeRow) {
      throw new Error(`Generated table locale is missing durable row ${rowId}.`);
    }
    const localeByCellId = new Map<string, JsonObject>();
    const localeCells = array(localeRow.cells);
    for (const value of localeCells) {
      const cell = object(value);
      const cellId = requireTableIdentity(cell.cellId, `locale cell in row ${rowId}`);
      if (localeByCellId.has(cellId)) {
        throw new Error(`Generated table locale row ${rowId} contains a missing or duplicate durable cell ID.`);
      }
      localeByCellId.set(cellId, cell);
    }
    if (localeByCellId.size !== cells.length) {
      throw new Error(`Generated table base and locale durable cell sets do not match for row ${rowId}.`);
    }
    let columnIndex = 0;
    return {
      type: 'tableRow',
      attrs: { id: rowId },
      content: cells.map(({ cell, cellId }) => {
        const localeCell = localeByCellId.get(cellId);
        if (!localeCell) {
          throw new Error(`Generated table locale row ${rowId} is missing durable cell ${cellId}.`);
        }
        const props = object(cell.props);
        const colspan = typeof props.colspan === 'number' ? props.colspan : 1;
        const colwidth = columnWidths.slice(columnIndex, columnIndex + colspan);
        columnIndex += colspan;
        return {
          type: cell.header === true ? 'tableHeader' : 'tableCell',
          attrs: {
            id: cellId,
            ...tableCellPropsToTiptap(props),
            ...(colwidth.length === colspan && colwidth.every((width) => typeof width === 'number' && width > 0)
              ? { colwidth }
              : {}),
          },
          content: [
            {
              type: 'tableParagraph',
              content: array(localeCell.content).flatMap(inlineToTiptap),
            },
          ],
        };
      }),
    };
  });
}

function descriptorToTiptap(
  block: ProseMirrorBlockDescriptor,
  depth: number,
  options: TiptapBlockRoomProjectionOptions,
): JSONContent {
  const attrs = {
    ...blockPropsToTiptap(block.adapter.kind, block.basePayload),
    ...blockPropsToTiptap(block.adapter.kind, block.localePayload ?? undefined),
    id: block.id,
  };
  const content: JSONContent[] = (() => {
    switch (block.adapter.contentShape) {
      case 'inline':
        return array(block.localePayload?.content).flatMap(inlineToTiptap);
      case 'plain-text': {
        const value = block.localePayload?.content;
        return typeof value === 'string' && value ? [{ type: 'text', text: value }] : [];
      }
      case 'table':
        return [...tableToTiptap(block.basePayload, block.localePayload ?? {})];
      case 'source-text': {
        const source = object(block.basePayload.props).source;
        return typeof source === 'string' && source ? [{ type: 'text', text: source }] : [];
      }
      case 'shader':
        return [...shaderToTiptap(block.basePayload)];
      case 'atom':
        return [];
    }
  })();
  const standaloneLink =
    options.paragraphExternalVideo && depth === 0 && block.adapter.kind === 'paragraph'
      ? standaloneLinkSource(content)
      : null;
  const presentation = standaloneLink
    ? linkPresentationNodeType((attrs as JsonObject).linkPresentation, standaloneLink.url)
    : null;
  const childGroup: JSONContent[] = block.children.length
    ? [
        {
          type: 'blockGroup',
          content: block.children.map((child) => descriptorToTiptap(child, depth + 1, options)),
        },
      ]
    : [];
  const contentNode: JSONContent =
    standaloneLink && presentation
      ? {
          type: presentation,
          attrs: {
            ...Object.fromEntries(Object.entries(attrs).filter(([field]) => field !== 'id')),
            url: standaloneLink.url,
            label: standaloneLink.label,
            sourceContent: content,
          },
        }
      : { type: block.adapter.nodeType, attrs, content };
  return {
    type: 'blockContainer',
    attrs: { id: block.id },
    content: [contentNode, ...childGroup],
  };
}

export function documentToTiptap(
  blocks: readonly ProseMirrorBlockDescriptor[],
  options: TiptapBlockRoomProjectionOptions = EXTERNAL_VIDEO_DISABLED,
): JSONContent {
  return {
    type: 'doc',
    content: [{ type: 'blockGroup', content: blocks.map((block) => descriptorToTiptap(block, 0, options)) }],
  };
}

function marksToStyles(marks: readonly TiptapMark[] | undefined): JsonObject {
  const styles: Record<string, JsonValue> = {};
  for (const mark of marks ?? []) {
    switch (mark.type) {
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strike':
      case 'code':
        styles[mark.type] = true;
        break;
      case 'textColor':
        if (typeof mark.attrs?.stringValue === 'string') {
          styles.textColor = mark.attrs.stringValue;
        }
        break;
      case 'backgroundColor':
        if (typeof mark.attrs?.stringValue === 'string') {
          styles.backgroundColor = mark.attrs.stringValue;
        }
        break;
      case 'link':
        break;
      default:
        throw new Error(`Unsupported rich-text mark: ${mark.type}`);
    }
  }
  return styles;
}

function inlineFromTiptap(content: readonly JSONContent[]): JsonValue[] {
  // JSON/Markdown imports and older editor clients can supply newline text.
  // Canonicalize before link grouping so no stored run contains a line break.
  const canonicalContent = content.flatMap((node) =>
    node.type === 'text' && node.text
      ? node.text
          .split(/\r\n|\r|\n/)
          .flatMap((text, index) => [...(index ? [{ type: 'hardBreak' }] : []), ...(text ? [{ ...node, text }] : [])])
      : [node],
  );
  const values: JsonValue[] = [];
  for (let index = 0; index < canonicalContent.length; index += 1) {
    const node = canonicalContent[index]!;
    if (node.type === 'siteVariable') {
      const key = node.attrs?.key;
      if (!isSiteVariableKey(key) || (node.attrs?.linked === true && !canLinkSiteVariable(key))) {
        throw new Error('Invalid site variable.');
      }
      values.push({ siteVariable: { key, linked: node.attrs?.linked === true, styles: marksToStyles(node.marks) } });
      continue;
    }
    if (node.type === 'hardBreak') {
      values.push({ hardBreak: {} });
      continue;
    }
    if (node.type === 'mathInline') {
      values.push({ mathInline: { source: (node.content ?? []).map((child) => child.text ?? '').join('') } });
      continue;
    }
    if (node.type === 'emoji') {
      const text = emojiTextForName(String(node.attrs?.name ?? ''));
      if (!text) {
        throw new Error(`Unsupported generated Emoji name: ${String(node.attrs?.name ?? '')}`);
      }
      values.push({ text: { text, styles: marksToStyles(node.marks) } });
      continue;
    }
    if (node.type !== 'text') {
      throw new Error(`Unsupported rich-text inline node: ${node.type}`);
    }
    if (!node.text) {
      continue;
    }
    const link = node.marks?.find((mark) => mark.type === 'link');
    const text = { text: node.text, styles: marksToStyles(node.marks?.filter((mark) => mark.type !== 'link')) };
    if (!link) {
      values.push({ text });
      continue;
    }
    const href = typeof link.attrs?.href === 'string' ? link.attrs.href : '';
    const previous = values.at(-1);
    if (previous && !Array.isArray(previous) && typeof previous === 'object' && previous.link) {
      const previousLink = object(previous.link);
      if (previousLink.href === href && Array.isArray(previousLink.content)) {
        previousLink.content.push(text);
        continue;
      }
    }
    values.push({ link: { href, content: [text] } });
  }
  return values;
}

/** Canonical wire content for defensive writes from low-level text clients. */
export function canonicalInlineContent(content: readonly JsonValue[]): JsonValue[] {
  return inlineFromTiptap(content.flatMap(inlineToTiptap));
}

export function inlineContentProjectionEqual(previous: readonly JsonValue[], next: readonly JsonValue[]): boolean {
  return jsonEqual(previous.flatMap(inlineToTiptap), next.flatMap(inlineToTiptap));
}

function protoCase(value: string): keyof typeof richTextBlockKindByProtoCase {
  const adapter = richTextProseMirrorAdapterForProtoCase(value);
  return adapter.protoCase;
}

function parseBlocks(
  group: JSONContent,
  options: TiptapBlockRoomProjectionOptions,
  parentBlockId?: string,
): readonly TiptapBlockSnapshot[] {
  return (group.content ?? []).map((container, index) => {
    if (container.type !== 'blockContainer' || typeof container.attrs?.id !== 'string') {
      throw new Error('Tiptap Block room document contains an invalid Block container.');
    }
    const blockNode = container.content?.[0];
    if (!blockNode?.type) {
      throw new Error(`Tiptap Block ${container.attrs.id} has no content node.`);
    }
    if ((blockNode.type === 'externalVideo' || blockNode.type === 'linkCard') && !options.paragraphExternalVideo) {
      throw new Error('This rich-text profile does not allow standalone external video Blocks.');
    }
    const nextGroup = container.content?.[1];
    const generatedCase =
      blockNode.type === 'externalVideo' || blockNode.type === 'linkCard' ? 'paragraph' : protoCase(blockNode.type);
    return {
      id: container.attrs.id,
      nodeType: blockNode.type,
      protoCase: generatedCase,
      kind: richTextBlockKindByProtoCase[generatedCase],
      parentBlockId,
      index,
      attrs: jsonAttributes(blockNode.attrs),
      content: blockNode.content ?? [],
      children: nextGroup?.type === 'blockGroup' ? parseBlocks(nextGroup, options, container.attrs.id) : [],
    };
  });
}

function externalVideoSourceContent(block: TiptapBlockSnapshot): readonly JSONContent[] {
  if (Array.isArray(block.attrs.sourceContent)) {
    return block.attrs.sourceContent as unknown as readonly JSONContent[];
  }
  const url = typeof block.attrs.url === 'string' ? block.attrs.url.trim() : '';
  if (!url || (block.nodeType === 'externalVideo' && !resolveExternalVideo(url))) {
    throw new Error(`Tiptap ${block.nodeType} Block ${block.id} has no supported source URL.`);
  }
  const label = typeof block.attrs.label === 'string' && block.attrs.label.trim() ? block.attrs.label.trim() : url;
  return [{ type: 'text', text: label, marks: [{ type: 'link', attrs: { href: url } }] }];
}

export function parseDocument(
  value: JSONContent,
  options: TiptapBlockRoomProjectionOptions = EXTERNAL_VIDEO_DISABLED,
): readonly TiptapBlockSnapshot[] {
  const group = value.content?.[0];
  if (value.type !== 'doc' || group?.type !== 'blockGroup') {
    throw new Error('Tiptap Block room document has an invalid root.');
  }
  return parseBlocks(group, options);
}

export function flatten(blocks: readonly TiptapBlockSnapshot[]): readonly TiptapBlockSnapshot[] {
  return blocks.flatMap((block) => [block, ...flatten(block.children)]);
}

export function jsonEqual(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function tableFromTiptap(content: readonly JSONContent[]): {
  baseRows: JsonValue[];
  localeRows: JsonValue[];
  columnWidths: number[];
} {
  const baseRows: JsonValue[] = [];
  const localeRows: JsonValue[] = [];
  const rowIds = new Set<string>();
  const cellIds = new Set<string>();
  for (const row of content) {
    if (row.type !== 'tableRow') {
      throw new Error(`Unsupported generated table row node: ${row.type}`);
    }
    const rowId = row.attrs?.id;
    if (!isBlockId(rowId) || rowIds.has(rowId)) {
      throw new Error('Generated table row requires a unique durable UUID identity.');
    }
    rowIds.add(rowId);
    const baseCells: JsonValue[] = [];
    const localeCells: JsonValue[] = [];
    for (const cell of row.content ?? []) {
      if (cell.type !== 'tableCell' && cell.type !== 'tableHeader') {
        throw new Error(`Unsupported generated table cell node: ${cell.type}`);
      }
      if (cell.content?.length !== 1 || cell.content[0]?.type !== 'tableParagraph') {
        throw new Error('Generated table cells require exactly one table paragraph.');
      }
      const cellId = cell.attrs?.id;
      if (!isBlockId(cellId) || cellIds.has(cellId)) {
        throw new Error(`Generated table row ${rowId} contains a cell without a unique durable UUID identity.`);
      }
      cellIds.add(cellId);
      const props: Record<string, JsonValue> = {};
      for (const [field, value] of Object.entries(jsonAttributes(cell.attrs))) {
        if (field === 'id') {
          continue;
        }
        const spec = TABLE_CELL_FIELDS[field];
        if (!spec || ('default' in spec && jsonEqual(value, spec.default as JsonValue))) {
          continue;
        }
        props[field] = encodeCatalogValue(spec, value);
      }
      baseCells.push({ id: cellId, header: cell.type === 'tableHeader', props });
      localeCells.push({ cellId, content: inlineFromTiptap(cell.content[0].content ?? []) });
    }
    baseRows.push({ id: rowId, cells: baseCells });
    localeRows.push({ rowId, cells: localeCells });
  }
  const firstRowWidths = (content[0]?.content ?? []).flatMap((cell) => {
    const widths: unknown = cell.attrs?.colwidth;
    const colspan = Number(cell.attrs?.colspan) || 1;
    return Array.isArray(widths) &&
      widths.length === colspan &&
      widths.every((width) => typeof width === 'number' && width > 0)
      ? (widths as number[])
      : [];
  });
  const columnCount = (content[0]?.content ?? []).reduce(
    (count, cell) => count + (Number(cell.attrs?.colspan) || 1),
    0,
  );
  const total = firstRowWidths.reduce((sum, width) => sum + width, 0);
  const columnWidths =
    firstRowWidths.length === columnCount && total > 0 ? firstRowWidths.map((width) => (width / total) * 100) : [];
  return { baseRows, localeRows, columnWidths };
}

function wireValueToCatalog(
  kind: RichTextBlockKind,
  field: string,
  spec: CatalogFieldSpec,
  value: JsonValue,
): JsonValue {
  if (spec.type === 'array' && typeof value === 'string') {
    const items = kind === 'map' ? value.split(',') : value.split(/\s+/);
    return items.map((item) => item.trim()).filter(Boolean);
  }
  if ((spec.type === 'integer' || spec.type === 'number') && typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Invalid generated numeric field ${kind}.${field}.`);
    }
    return parsed;
  }
  if (spec.type === 'boolean' && typeof value === 'string') {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    throw new Error(`Invalid generated boolean field ${kind}.${field}.`);
  }
  return value;
}

function shaderChannelsFromTiptap(value: unknown): JsonValue[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => {
    const channel = jsonAttributes(entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : undefined);
    const result = { ...channel };
    if (typeof result.fileId === 'string' && result.fileId) {
      result.file = { activeFileId: result.fileId };
      delete result.fileId;
    }
    if (Array.isArray(result.fileIds)) {
      result.faces = result.fileIds.map((fileId) => ({ activeFileId: fileId }));
      delete result.fileIds;
    }
    return result;
  });
}

function shaderStagesFromTiptap(content: readonly JSONContent[]): JsonValue[] {
  if (content.length !== SHADER_STAGE_DEFINITIONS.length) {
    throw new Error('Generated Shader requires exactly nine stage nodes.');
  }
  return SHADER_STAGE_DEFINITIONS.map(([kind, nodeType], index) => {
    const stage = content[index];
    if (stage?.type !== nodeType) {
      throw new Error(`Generated Shader stage ${index} must be ${nodeType}.`);
    }
    return {
      kind,
      source: (stage.content ?? []).map((node) => node.text ?? '').join(''),
      channels: shaderChannelsFromTiptap(stage.attrs?.channels),
    };
  });
}

export function splitPayload(block: TiptapBlockSnapshot): { base: JsonObject; locale: JsonObject } {
  const baseProps: Record<string, JsonValue> = {};
  const localeProps: Record<string, JsonValue> = {};
  const fields = richTextBlockCatalog[block.kind].fields as Readonly<Record<string, CatalogFieldSpec>>;
  for (const [field, value] of Object.entries(block.attrs)) {
    if (field === 'id') {
      continue;
    }
    const canonicalField = block.kind === 'map' && field === 'show3DBuildings' ? 'show3dBuildings' : field;
    const spec = fields[canonicalField];
    if (!spec) {
      continue;
    }
    if (value === '' && !('default' in spec)) {
      continue;
    }
    if (spec && 'default' in spec && jsonEqual(value, spec.default as JsonValue)) {
      continue;
    }
    const owner = richTextBlockFieldOwnership(block.kind, canonicalField);
    const catalogValue = wireValueToCatalog(block.kind, canonicalField, spec, value);
    (owner === 'locale' ? localeProps : baseProps)[canonicalField] = encodeCatalogValue(spec, catalogValue);
  }
  if (
    block.kind === 'paragraph' &&
    typeof block.attrs.linkThumbnailFileId === 'string' &&
    block.attrs.linkThumbnailFileId
  ) {
    baseProps.linkThumbnail = { activeFileId: block.attrs.linkThumbnailFileId };
  }
  if (block.kind === 'file') {
    if (typeof block.attrs.fileId === 'string' && block.attrs.fileId) {
      baseProps.attachment = { activeFileId: block.attrs.fileId };
    } else {
      const attachment = object(block.attrs.attachment);
      if (Object.hasOwn(attachment, 'missingAttachment')) {
        baseProps.attachment = attachment;
      }
    }
  }
  const base: Record<string, JsonValue> = { props: baseProps };
  const locale: Record<string, JsonValue> = { props: localeProps };
  const shape = richTextProseMirrorAdapterForProtoCase(block.protoCase).contentShape;
  if (shape === 'inline') {
    locale.content = inlineFromTiptap(
      block.nodeType === 'externalVideo' || block.nodeType === 'linkCard'
        ? externalVideoSourceContent(block)
        : block.content,
    );
  }
  if (shape === 'plain-text') {
    locale.content = block.content.map((node) => node.text ?? '').join('');
  }
  if (shape === 'table') {
    const table = tableFromTiptap(block.content);
    base.content = { rows: table.baseRows, ...(table.columnWidths.length ? { columnWidths: table.columnWidths } : {}) };
    locale.content = { rows: table.localeRows };
  }
  if (shape === 'source-text') {
    baseProps.source = block.content.map((node) => node.text ?? '').join('');
  }
  if (shape === 'shader') {
    const stages = shaderStagesFromTiptap(block.content);
    const spec = fields.stages;
    if (!spec) {
      throw new Error('Generated Shader stages catalog is missing.');
    }
    baseProps.stages = encodeCatalogValue(spec, stages);
  }
  return { base, locale };
}

export function generatedData(
  proto: keyof typeof richTextBlockKindByProtoCase,
  payload: JsonObject,
): RichTextBlockData {
  return fromJson(RichTextBlockDataSchema, { [proto]: payload });
}

export function generatedLocaleData(
  proto: keyof typeof richTextBlockKindByProtoCase,
  payload: JsonObject,
): RichTextBlockLocaleData {
  return fromJson(RichTextBlockLocaleDataSchema, { [proto]: payload });
}

export function emptyLocalePayload(
  proto: keyof typeof richTextBlockKindByProtoCase,
  basePayload: JsonObject,
): JsonObject {
  const shape = richTextProseMirrorAdapterForProtoCase(proto).contentShape;
  if (shape === 'inline') {
    return { props: {}, content: [] };
  }
  if (shape === 'plain-text') {
    return { props: {}, content: '' };
  }
  if (shape === 'table') {
    const rows = array(object(basePayload.content).rows).map((row) => ({
      rowId: object(row).id,
      cells: array(object(row).cells).map((cell) => ({ cellId: object(cell).id, content: [] })),
    }));
    return { props: {}, content: { rows } };
  }
  return { props: {} };
}
