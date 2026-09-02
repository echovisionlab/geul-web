import type { LocalizedPageDocument, RichTextInline } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { materializeCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import * as Y from 'yjs';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { materializeLocalizedPageSections, type LocalizedPageSection } from '@/features/editor/contract/localized-page';
import type { LooseBlock } from '@/lib/types/editor/schema';

const PAGE_SECTION_LABELS: Record<string, string> = {
  'rich-text': 'Rich Text',
  'post-list': 'Post List',
  'post-table': 'Post Table',
  'post-map': 'Post Map',
  'work-map': 'Work Map',
  'work-table': 'Work Table',
  'work-list': 'Work List',
  'program-event-list': 'Event List',
  'release-list': 'Release List',
  'artist-list': 'Artist List',
  'label-list': 'Label List',
  'author-list': 'Author List',
  form: 'Form',
  map: 'Map',
  columns: 'Columns',
};

const PAGE_SECTION_PROP_LABELS: Record<string, string> = {
  title: 'Section title',
  label: 'Section label',
  layout: 'Layout',
  description: 'Description',
  caption: 'Caption',
  publication: 'Publication',
  placeLabel: 'Place label',
};

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function pushUnique(lines: string[], value: string): void {
  const normalized = normalizeWhitespace(value);
  if (!normalized || lines.includes(normalized)) {
    return;
  }
  lines.push(normalized);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? normalizeWhitespace(value) : '';
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => readString(item)).filter(Boolean);
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function isLikelyURL(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function extractSemanticInlineText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(extractSemanticInlineText).filter(Boolean).join(' ');
  }

  const record = readRecord(value);
  if (!record) {
    return '';
  }

  const parts: string[] = [];
  if (typeof record.text === 'string') {
    parts.push(record.text);
  }

  if (record.type === 'mathInline') {
    const props = readRecord(record.props);
    const latex = readString(props?.latex ?? record.latex);
    if (latex) {
      parts.push(latex);
    }
  }

  if ('children' in record) {
    parts.push(extractSemanticInlineText(record.children));
  }

  if ('content' in record) {
    parts.push(extractSemanticInlineText(record.content));
  }

  return normalizeWhitespace(parts.filter(Boolean).join(' '));
}

function readLabeledValue(label: string, value: unknown): string {
  const normalized = readString(value);
  if (!normalized) {
    return '';
  }
  return `${label}: ${normalized}`;
}

function pushLabeled(lines: string[], label: string, value: unknown): void {
  const labeled = readLabeledValue(label, value);
  if (!labeled) {
    return;
  }
  pushUnique(lines, labeled);
}

function extractMediaLines(
  label: string,
  props: Record<string, unknown>,
  nameLabel: 'name' | 'file' = 'name',
): string[] {
  const lines: string[] = [];
  const name = readString(props.name);
  const caption = readString(props.caption);
  const alt = readString(props.alt);

  pushLabeled(lines, `${label} ${nameLabel}`, name);
  if (caption && caption !== name) {
    pushLabeled(lines, `${label} caption`, caption);
  }
  if (alt && alt !== caption && alt !== name) {
    pushLabeled(lines, `${label} alt`, alt);
  }

  return lines;
}

function mediaLabelFromFileProps(props: Record<string, unknown>): string {
  const mimeType = readString(props.mimeType).toLowerCase();
  if (mimeType.startsWith('image/')) {
    return 'Image';
  }
  if (mimeType.startsWith('video/')) {
    return 'Video';
  }
  if (mimeType.startsWith('audio/')) {
    return 'Audio';
  }
  return 'File';
}

function formatBlockTypeLabel(type: string): string {
  switch (type) {
    case 'heading':
      return 'Heading';
    case 'quote':
      return 'Quote';
    case 'codeBlock':
      return 'Code';
    default:
      return type
        .replace(/([A-Z])/g, ' $1')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^./, (match) => match.toUpperCase());
  }
}

function extractBlockMetadataLines(block: LooseBlock): string[] {
  const lines: string[] = [];
  const blockText = extractSemanticInlineText(block.content);
  const props = readRecord(block.props) ?? {};

  switch (block.type) {
    case 'heading':
      pushLabeled(lines, 'Heading', blockText);
      break;
    case 'quote':
      pushLabeled(lines, 'Quote', blockText);
      break;
    case 'codeBlock':
      pushLabeled(lines, 'Code', blockText);
      pushLabeled(lines, 'Code language', props.language);
      break;
    case 'math':
      pushLabeled(lines, 'Math', props.latex);
      break;
    case 'file':
      lines.push(...extractMediaLines(mediaLabelFromFileProps(props), props, 'file'));
      break;
    case 'map':
      pushLabeled(lines, 'Map caption', props.caption);
      pushLabeled(lines, 'Map location', props.location);
      break;
    default:
      if (blockText) {
        if (
          block.type === 'paragraph' ||
          block.type === 'bulletListItem' ||
          block.type === 'numberedListItem' ||
          block.type === 'checkListItem'
        ) {
          pushUnique(lines, blockText);
        } else {
          pushLabeled(lines, formatBlockTypeLabel(block.type), blockText);
        }
      }
      break;
  }

  for (const child of block.children ?? []) {
    lines.push(...extractBlockMetadataLines(child));
  }

  return lines;
}

function isLooseBlock(value: unknown): value is LooseBlock {
  const record = readRecord(value);
  return !!record && typeof record.type === 'string' && Array.isArray(record.children);
}

function coerceLooseBlocks(value: unknown): LooseBlock[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => coerceLooseBlocks(item));
  }

  if (isLooseBlock(value)) {
    return [value];
  }

  return [];
}

function getDomParser(): DOMParser | null {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser();
  }
  return null;
}

function parseXmlAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attrRegex = /([a-zA-Z_:][\w:.-]*)="([^"]*)"/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(source)) !== null) {
    attributes[match[1]] = match[2];
  }

  return attributes;
}

function stripXmlTags(source: string): string {
  return normalizeWhitespace(
    source
      .replace(/<mathinline\b([^>]*)>(.*?)<\/mathinline>/gi, (_, attrs, inner) => {
        const parsed = parseXmlAttributes(attrs);
        return readString(parsed.latex || inner);
      })
      .replace(/<[^>]+>/g, ' '),
  );
}

function extractXmlInlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  if (tag === 'mathinline') {
    return readString(element.getAttribute('latex'));
  }

  return Array.from(element.childNodes).map(extractXmlInlineText).filter(Boolean).join(' ');
}

function extractXmlElementMetadataLines(element: Element): string[] {
  const tag = element.tagName.toLowerCase();
  const lines: string[] = [];

  if (tag === 'blockgroup' || tag === 'blockcontainer') {
    for (const child of Array.from(element.children)) {
      lines.push(...extractXmlElementMetadataLines(child));
    }
    return lines;
  }

  const text = normalizeWhitespace(extractXmlInlineText(element));
  const props: Record<string, unknown> = {
    title: element.getAttribute('title') ?? '',
    caption: element.getAttribute('caption') ?? '',
    alt: element.getAttribute('alt') ?? '',
    name: element.getAttribute('name') ?? '',
    language: element.getAttribute('language') ?? '',
    latex: element.getAttribute('latex') ?? '',
    location: element.getAttribute('location') ?? '',
    mimeType: element.getAttribute('mimeType') ?? '',
  };

  switch (tag) {
    case 'heading':
      pushLabeled(lines, 'Heading', text);
      break;
    case 'quote':
      pushLabeled(lines, 'Quote', text);
      break;
    case 'codeblock':
      pushLabeled(lines, 'Code', text);
      pushLabeled(lines, 'Code language', props.language);
      break;
    case 'math':
      pushLabeled(lines, 'Math', props.latex || text);
      break;
    case 'file':
      lines.push(...extractMediaLines(mediaLabelFromFileProps(props), props, 'file'));
      break;
    case 'map':
      pushLabeled(lines, 'Map caption', props.caption);
      pushLabeled(lines, 'Map location', props.location);
      break;
    default:
      if (tag === 'paragraph' || tag === 'bulletlistitem' || tag === 'numberedlistitem' || tag === 'checklistitem') {
        pushUnique(lines, text);
      } else if (text) {
        pushLabeled(lines, formatBlockTypeLabel(tag), text);
      }
      break;
  }

  return lines;
}

function extractXmlStringMetadataText(xml: string): string {
  const parser = getDomParser();
  if (parser) {
    const document = parser.parseFromString(xml, 'text/xml');
    const root = document.documentElement;
    if (!root) {
      return '';
    }

    return root ? extractXmlElementMetadataLines(root).filter(Boolean).join('\n').trim() : '';
  }

  const lines: string[] = [];
  const blockRegex = /<(paragraph|heading|quote|codeblock|math|file|map)\b([^>]*?)(?:>([\s\S]*?)<\/\1>|\s*\/>)/gi;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(xml)) !== null) {
    const [, tag, attrsSource, inner = ''] = match;
    const attrs = parseXmlAttributes(attrsSource);
    const text = stripXmlTags(inner);
    const props: Record<string, unknown> = {
      title: attrs.title ?? '',
      caption: attrs.caption ?? '',
      alt: attrs.alt ?? '',
      name: attrs.name ?? '',
      language: attrs.language ?? '',
      latex: attrs.latex ?? '',
      location: attrs.location ?? '',
      mimeType: attrs.mimeType ?? '',
    };

    switch (tag.toLowerCase()) {
      case 'heading':
        pushLabeled(lines, 'Heading', text);
        break;
      case 'quote':
        pushLabeled(lines, 'Quote', text);
        break;
      case 'codeblock':
        pushLabeled(lines, 'Code', text);
        pushLabeled(lines, 'Code language', props.language);
        break;
      case 'math':
        pushLabeled(lines, 'Math', props.latex || text);
        break;
      case 'file':
        lines.push(...extractMediaLines(mediaLabelFromFileProps(props), props, 'file'));
        break;
      case 'map':
        pushLabeled(lines, 'Map caption', props.caption);
        pushLabeled(lines, 'Map location', props.location);
        break;
      default:
        pushUnique(lines, text);
        break;
    }
  }

  return lines.join('\n').trim();
}

function extractFragmentBlocks(fragment: Y.XmlFragment | null | undefined): LooseBlock[] {
  if (!fragment) {
    return [];
  }

  return fragment.toArray().flatMap((item) => {
    if (typeof item === 'string') {
      return [];
    }
    if (item && typeof item === 'object' && 'toJSON' in item && typeof item.toJSON === 'function') {
      return coerceLooseBlocks(item.toJSON());
    }
    return [];
  });
}

function extractSectionPropLines(props: Record<string, unknown> | null | undefined): string[] {
  if (!props) {
    return [];
  }

  const lines: string[] = [];
  for (const [key, label] of Object.entries(PAGE_SECTION_PROP_LABELS)) {
    const value = props[key];
    if (typeof value === 'string' && value && !isLikelyURL(value)) {
      pushLabeled(lines, label, value);
    } else if (Array.isArray(value)) {
      const values = readStringArray(value).filter((item) => !isLikelyURL(item));
      if (values.length > 0) {
        pushLabeled(lines, label, values.join(', '));
      }
    }
  }
  return lines;
}

function generatedInlineText(values: readonly RichTextInline[]): string {
  return normalizeWhitespace(
    values
      .map((inline) => {
        switch (inline.value.case) {
          case 'text':
            return inline.value.value.text;
          case 'hardBreak':
            return ' ';
          case 'link':
            return inline.value.value.content.map((text) => text.text).join('');
          case 'mathInline':
            return inline.value.value.source;
          case undefined:
            throw new Error('Generated rich-text inline has no kind.');
          default:
            return inline.value satisfies never;
        }
      })
      .join(' '),
  );
}

function extractGeneratedRichTextBlockLines(block: LocalizedRichTextBlock): string[] {
  const lines: string[] = [];
  switch (block.kind) {
    case 'paragraph':
    case 'bullet-list-item':
    case 'numbered-list-item':
    case 'check-list-item':
      pushUnique(lines, generatedInlineText(block.locale.content));
      break;
    case 'heading':
      pushLabeled(lines, 'Heading', generatedInlineText(block.locale.content));
      break;
    case 'quote':
      pushLabeled(lines, 'Quote', generatedInlineText(block.locale.content));
      break;
    case 'callout':
      pushLabeled(lines, 'Callout', generatedInlineText(block.locale.content));
      break;
    case 'code-block':
      pushLabeled(lines, 'Code', block.locale.content);
      break;
    case 'table':
      pushUnique(
        lines,
        (block.locale.content?.rows ?? [])
          .flatMap((row) => row.cells.map((cell) => generatedInlineText(cell.content)))
          .join(' '),
      );
      break;
    case 'p5-sketch':
    case 'three-scene':
      pushLabeled(lines, formatBlockTypeLabel(block.kind), block.base.props?.source);
      break;
    case 'shader':
      pushLabeled(lines, 'Shader', block.base.props?.stages.map((stage) => stage.source).join('\n'));
      break;
    case 'math':
      pushLabeled(lines, 'Math', block.base.props?.latex);
      break;
    case 'file':
      pushLabeled(lines, 'File file', block.base.props?.name);
      break;
    case 'divider':
    case 'map':
      break;
    default:
      return block satisfies never;
  }
  for (const child of block.children) {
    lines.push(...extractGeneratedRichTextBlockLines(child));
  }
  return lines;
}

function extractSectionMetadataLines(section: LocalizedPageSection, depth = 0): string[] {
  const lines: string[] = [];
  const type = section.kind;

  const prefix = depth > 0 ? `Nested section` : 'Section';
  const label = PAGE_SECTION_LABELS[type] ?? formatBlockTypeLabel(type);
  pushUnique(lines, `${prefix}: ${label}`);

  lines.push(...extractSectionPropLines(section.props));

  if (type === 'rich-text') {
    lines.push(...(section.richText ?? []).flatMap(extractGeneratedRichTextBlockLines));
  }

  if (type === 'columns') {
    section.columns.forEach((column, columnIndex) => {
      pushUnique(lines, `Column ${columnIndex + 1}`);
      column.sections.forEach((childSection) => {
        lines.push(...extractSectionMetadataLines(childSection, depth + 1));
      });
    });
  }

  return lines;
}

export function extractBlocksMetadataText(blocks: LooseBlock[]): string {
  const lines = blocks.flatMap((block) => extractBlockMetadataLines(block));
  return lines.filter(Boolean).join('\n').trim();
}

export function extractXmlFragmentMetadataText(fragment: Y.XmlFragment | null | undefined): string {
  const blocks = extractFragmentBlocks(fragment);
  if (blocks.length > 0) {
    return extractBlocksMetadataText(blocks);
  }

  if (!fragment) {
    return '';
  }

  return fragment
    .toArray()
    .map((item) => {
      if (typeof item === 'string') {
        return extractXmlStringMetadataText(item);
      }
      if (item && typeof item === 'object' && 'toJSON' in item && typeof item.toJSON === 'function') {
        const json = item.toJSON();
        if (typeof json === 'string') {
          return extractXmlStringMetadataText(json);
        }
      }
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function extractDocumentStoreMetadataText(doc: Y.Doc | null | undefined): string {
  if (!doc) {
    return '';
  }
  return extractXmlFragmentMetadataText(doc.getXmlFragment('document-store'));
}

export function extractPageDocumentMetadataText(doc: Y.Doc | null | undefined): string {
  if (!doc) {
    return '';
  }

  const canonical = materializeCanonicalBlockRoom(doc, 'page');
  if (canonical.$typeName !== 'api.content.v1.LocalizedPageDocument') {
    throw new Error('Expected a typed localized Page document.');
  }
  const page = canonical as LocalizedPageDocument;
  const sections = materializeLocalizedPageSections(page);

  return sections
    .flatMap((section) => extractSectionMetadataLines(section))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}
