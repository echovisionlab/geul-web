import { normalizeRichTextHtmlLinksFromBlocks } from '@echovisionlab/geul-common/editor/link-normalization';
import { JSDOM } from 'jsdom';
import { yXmlFragmentToProseMirrorRootNode } from 'y-prosemirror';
import * as Y from 'yjs';
import { hasAttachedFileId } from '@echovisionlab/geul-common/media/block-schemas';
import { buildAudioMediaDom, buildVideoMediaDom } from '@/lib/media/dom-builders';
import { resolveAudioViewModel } from '@/lib/media/audio-view-model';
import { resolveVideoViewModel } from '@/lib/media/video-view-model';
import {
  formatMediaSize,
  normalizeMediaTextAlignment,
  resolveMediaContainerStyle,
  resolveMediaDownloadName,
  mediaStyleToString,
} from '@/lib/media/shared';
import { buildContentScopedFileUrl } from '@/lib/media/content-scoped-file-url';
import { DEFAULT_MAP_CONFIG } from '@/lib/types/map/model';
import { createPostWireSchema } from '@/features/editor/tiptap/server-wire-schema';
import {
  addHeadingIds,
  applyCodeHighlighting,
  applyMathRendering,
  extractHeadings,
  extractText,
  unescapeLatex,
  type ConvertedContent,
} from './core';
import { injectMapData } from './map-data';

export type { ConvertedContent } from './core';

type InlineNode = {
  type: string;
  text?: string;
  href?: string;
  props?: Record<string, unknown>;
  styles?: Record<string, unknown>;
  content?: InlineNode[];
};

type ShaderStageNode = {
  type: ShaderStageType;
  props?: { channels?: ShaderChannel[] };
  content: InlineNode[];
};

const SHADER_STAGES = [
  ['shaderCommon', 'common.glsl'],
  ['shaderVertex', 'vert.glsl'],
  ['shaderBufferA', 'buffer-a.glsl'],
  ['shaderBufferB', 'buffer-b.glsl'],
  ['shaderBufferC', 'buffer-c.glsl'],
  ['shaderBufferD', 'buffer-d.glsl'],
  ['shaderCubemap', 'cubemap.glsl'],
  ['shaderSound', 'sound.glsl'],
  ['shaderImage', 'frag.glsl'],
] as const;
type ShaderStageType = (typeof SHADER_STAGES)[number][0];
type ShaderSampler = { filter: 'nearest' | 'linear'; wrap: 'clamp' | 'repeat'; vflip: boolean };
type ShaderChannel =
  | { kind: 'none' }
  | { kind: 'buffer'; buffer: 'A' | 'B' | 'C' | 'D' }
  | { kind: 'textureFile'; fileId: string; sampler: ShaderSampler }
  | { kind: 'videoFile'; fileId: string; sampler: ShaderSampler }
  | { kind: 'cubemapFiles'; fileIds: [string, string, string, string, string, string]; sampler: ShaderSampler }
  | { kind: 'cubemapPass'; sampler: ShaderSampler };

export interface DurablePostBlock {
  id: string;
  type: string;
  props: Record<string, unknown>;
  content?:
    | InlineNode[]
    | ShaderStageNode[]
    | {
        type: 'tableContent';
        columnWidths?: number[];
        rows: Array<{ cells: Array<{ type: 'tableCell'; props: Record<string, unknown>; content: InlineNode[] }> }>;
      };
  children: DurablePostBlock[];
}

type PmJson = { type?: unknown; text?: unknown; attrs?: unknown; marks?: unknown; content?: unknown };

const postWireSchema = createPostWireSchema();

const supportedBlocks = new Set([
  'paragraph',
  'heading',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'quote',
  'codeBlock',
  'p5Sketch',
  'threeScene',
  'shader',
  'divider',
  'file',
  'math',
  'map',
  'table',
]);
const supportedMarks = new Set([
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'textColor',
  'backgroundColor',
  'link',
]);

function validatePersistedWire(fragment: Y.XmlFragment): void {
  const visit = (value: Y.XmlFragment | Y.XmlElement | Y.XmlText, parentNodeName?: string): void => {
    if (value instanceof Y.XmlFragment && !(value instanceof Y.XmlElement)) {
      for (const child of value.toArray()) {
        if (child instanceof Y.XmlElement || child instanceof Y.XmlText) {
          visit(child);
        }
      }
      return;
    }
    if (value instanceof Y.XmlElement) {
      const nodeType = postWireSchema.nodes[value.nodeName];
      if (!nodeType) {
        failUnsupported('node', value.nodeName);
      }
      const allowedAttributes = nodeType.spec.attrs ?? {};
      for (const name of Object.keys(value.getAttributes())) {
        if (!(name in allowedAttributes)) {
          if (
            value.nodeName === 'p5Sketch' &&
            ['camera', 'microphone', 'motion', 'midi', 'gamepad', 'serial'].includes(name)
          ) {
            throw new Error('Invalid durable editor p5Sketch device capability');
          }
          throw new Error(`Unsupported durable editor ${value.nodeName} attribute: ${name}`);
        }
      }
      if (
        value.nodeName === 'shader' &&
        (value.length !== SHADER_STAGES.length ||
          value
            .toArray()
            .some((child, index) => !(child instanceof Y.XmlElement) || child.nodeName !== SHADER_STAGES[index]?.[0]))
      ) {
        throw new Error('Invalid durable editor shader stage content');
      }
      for (const child of value.toArray()) {
        if (child instanceof Y.XmlElement || child instanceof Y.XmlText) {
          visit(child, value.nodeName);
        }
      }
      return;
    }
    if (value instanceof Y.XmlText) {
      for (const part of value.toDelta()) {
        if (Object.keys(part.attributes ?? {}).length > 0) {
          if (parentNodeName === 'p5Sketch' || parentNodeName === 'threeScene') {
            throw new Error(`Invalid durable editor ${parentNodeName} source content`);
          }
          if (parentNodeName?.startsWith('shader')) {
            throw new Error('Invalid durable editor shader source content');
          }
        }
        for (const [name, attributes] of Object.entries(part.attributes ?? {})) {
          const markType = postWireSchema.marks[name];
          if (!markType) {
            failUnsupported('mark', name);
          }
          if (attributes && typeof attributes === 'object' && !Array.isArray(attributes)) {
            const allowedAttributes = markType.spec.attrs ?? {};
            for (const attributeName of Object.keys(attributes)) {
              if (!(attributeName in allowedAttributes)) {
                throw new Error(`Unsupported durable editor ${name} attribute: ${attributeName}`);
              }
            }
          }
        }
      }
    }
  };
  visit(fragment);
}

function failUnsupported(kind: 'node' | 'mark', type: unknown): never {
  throw new Error(`Unsupported durable editor ${kind}: ${typeof type === 'string' ? type : String(type)}`);
}

type ExecutableBlockType = 'p5Sketch' | 'threeScene' | 'shader';

const executableBlockTypes = new Set<ExecutableBlockType>(['p5Sketch', 'threeScene', 'shader']);

function isExecutableBlockType(type: string): type is ExecutableBlockType {
  return executableBlockTypes.has(type as ExecutableBlockType);
}

function validateExecutableProps(type: ExecutableBlockType, value: unknown): Record<string, unknown> {
  const props = record(value);
  const allowed = new Set([
    'title',
    'mode',
    'previewHeight',
    'previewWidth',
    'textAlignment',
    ...(type === 'p5Sketch' ? ['capabilities'] : []),
    ...(type === 'threeScene' ? ['language'] : []),
  ]);
  for (const name of Object.keys(props)) {
    if (!allowed.has(name)) {
      throw new Error(`Unsupported durable editor ${type} attribute: ${name}`);
    }
  }
  if (props.mode !== undefined && !['edit', 'source', 'preview'].includes(String(props.mode))) {
    throw new Error(`Invalid durable editor ${type} attribute: mode`);
  }
  if (
    props.previewHeight !== undefined &&
    (typeof props.previewHeight !== 'number' || !Number.isFinite(props.previewHeight))
  ) {
    throw new Error(`Invalid durable editor ${type} attribute: previewHeight`);
  }
  if (
    props.previewWidth !== undefined &&
    typeof props.previewWidth !== 'string' &&
    (typeof props.previewWidth !== 'number' || !Number.isFinite(props.previewWidth))
  ) {
    throw new Error(`Invalid durable editor ${type} attribute: previewWidth`);
  }
  if (props.textAlignment !== undefined && !['left', 'center', 'right'].includes(String(props.textAlignment))) {
    throw new Error(`Invalid durable editor ${type} attribute: textAlignment`);
  }
  if (type === 'p5Sketch') {
    if (props.capabilities !== undefined && typeof props.capabilities !== 'string') {
      throw new Error('Invalid durable editor p5Sketch capabilities');
    }
    const values = String(props.capabilities ?? '')
      .split(/[\s,]+/u)
      .filter(Boolean);
    const known = ['camera', 'microphone', 'motion', 'midi', 'gamepad', 'serial'] as const;
    if (values.some((value) => !known.includes(value as (typeof known)[number]))) {
      throw new Error('Invalid durable editor p5Sketch capabilities');
    }
    props.capabilities = known.filter((value) => values.includes(value)).join(' ');
  }
  if (
    type === 'threeScene' &&
    props.language !== undefined &&
    !['javascript', 'typescript'].includes(String(props.language))
  ) {
    throw new Error('Invalid durable editor threeScene attribute: language');
  }
  return props;
}

function executableContentFromPm(nodes: PmJson[], type: ExecutableBlockType): InlineNode[] {
  return nodes.map((node) => {
    if (node.type !== 'text' || typeof node.text !== 'string' || node.marks !== undefined || node.attrs !== undefined) {
      throw new Error(`Invalid durable editor ${type} source content`);
    }
    return { type: 'text', text: node.text, styles: {} };
  });
}

function shaderSampler(value: unknown): ShaderSampler {
  const sampler = record(value);
  if (
    !['nearest', 'linear'].includes(String(sampler.filter)) ||
    !['clamp', 'repeat'].includes(String(sampler.wrap)) ||
    typeof sampler.vflip !== 'boolean' ||
    Object.keys(sampler).some((key) => !['filter', 'wrap', 'vflip'].includes(key))
  ) {
    throw new Error('Invalid durable editor shader channel sampler');
  }
  return sampler as ShaderSampler;
}

function shaderChannel(value: unknown): ShaderChannel {
  const channel = record(value);
  if (channel.kind === 'none' && Object.keys(channel).length === 1) {
    return { kind: 'none' };
  }
  if (
    channel.kind === 'buffer' &&
    ['A', 'B', 'C', 'D'].includes(String(channel.buffer)) &&
    Object.keys(channel).length === 2
  ) {
    return { kind: 'buffer', buffer: channel.buffer as 'A' | 'B' | 'C' | 'D' };
  }
  if (
    (channel.kind === 'textureFile' || channel.kind === 'videoFile') &&
    typeof channel.fileId === 'string' &&
    channel.fileId.trim() &&
    Object.keys(channel).length === 3
  ) {
    return { kind: channel.kind, fileId: channel.fileId, sampler: shaderSampler(channel.sampler) };
  }
  if (
    channel.kind === 'cubemapFiles' &&
    Array.isArray(channel.fileIds) &&
    channel.fileIds.length === 6 &&
    channel.fileIds.every((id) => typeof id === 'string' && id.trim()) &&
    Object.keys(channel).length === 3
  ) {
    return {
      kind: 'cubemapFiles',
      fileIds: channel.fileIds as [string, string, string, string, string, string],
      sampler: shaderSampler(channel.sampler),
    };
  }
  if (channel.kind === 'cubemapPass' && Object.keys(channel).length === 2) {
    return { kind: 'cubemapPass', sampler: shaderSampler(channel.sampler) };
  }
  throw new Error('Invalid durable editor shader channel');
}

function shaderChannels(value: unknown): ShaderChannel[] {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new Error('Invalid durable editor shader channels');
  }
  return value.map(shaderChannel);
}

function assertShaderBufferDag(stages: ShaderStageNode[]): void {
  const buffers = new Map(['A', 'B', 'C', 'D'].map((name, index) => [name, stages[index + 2]!] as const));
  const visit = (name: string, path: Set<string>) => {
    if (path.has(name)) {
      throw new Error('Invalid durable editor shader buffer dependency cycle');
    }
    const nextPath = new Set(path).add(name);
    for (const channel of buffers.get(name)?.props?.channels ?? []) {
      if (channel.kind === 'buffer' && channel.buffer !== name) {
        visit(channel.buffer, nextPath);
      }
    }
  };
  for (const name of buffers.keys()) {
    visit(name, new Set());
  }
}

function shaderContentFromPm(nodes: PmJson[]): ShaderStageNode[] {
  if (nodes.length !== SHADER_STAGES.length) {
    throw new Error('Invalid durable editor shader stage content');
  }
  const stages = nodes.map((node, index) => {
    const expectedType = SHADER_STAGES[index]![0];
    const channelStage = index >= 2;
    const attrs = record(node.attrs);
    if (
      node.type !== expectedType ||
      node.marks !== undefined ||
      node.text !== undefined ||
      (channelStage ? Object.keys(attrs).some((key) => key !== 'channels') : Object.keys(attrs).length > 0)
    ) {
      throw new Error('Invalid durable editor shader stage content');
    }
    return {
      type: expectedType,
      ...(channelStage ? { props: { channels: shaderChannels(attrs.channels) } } : {}),
      content: executableContentFromPm(pmContent(node.content), 'shader'),
    };
  });
  assertShaderBufferDag(stages);
  return stages;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pmContent(value: unknown): PmJson[] {
  return Array.isArray(value) ? (value as PmJson[]) : [];
}

function inlineFromPm(nodes: PmJson[]): InlineNode[] {
  const result: InlineNode[] = [];
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      result.push({ type: 'text', text: '\n', styles: {} });
      continue;
    }
    if (node.type === 'mathInline') {
      const source =
        pmContent(node.content)
          .map((child) => (typeof child.text === 'string' ? child.text : ''))
          .join('') || String(record(node.attrs).latex ?? '');
      result.push({ type: 'mathInline', props: { latex: source } });
      continue;
    }
    if (node.type !== 'text' || typeof node.text !== 'string') {
      failUnsupported('node', node.type);
    }

    const styles: Record<string, unknown> = {};
    let href: string | undefined;
    for (const mark of pmContent(node.marks)) {
      if (typeof mark.type !== 'string' || !supportedMarks.has(mark.type)) {
        failUnsupported('mark', mark.type);
      }
      if (mark.type === 'link') {
        const value = record(mark.attrs).href;
        if (typeof value !== 'string') {
          throw new Error('Unsupported durable editor link without href');
        }
        href = value;
      } else if (mark.type === 'textColor' || mark.type === 'backgroundColor') {
        const value = record(mark.attrs).stringValue;
        if (typeof value === 'string') {
          styles[mark.type] = value;
        }
      } else {
        styles[mark.type] = true;
      }
    }
    const text: InlineNode = { type: 'text', text: node.text, styles };
    result.push(href === undefined ? text : { type: 'link', href, content: [text] });
  }
  return result;
}

function tableFromPm(node: PmJson): DurablePostBlock['content'] {
  const rows = pmContent(node.content).map((row) => {
    if (row.type !== 'tableRow') {
      failUnsupported('node', row.type);
    }
    return {
      cells: pmContent(row.content).map((cell) => {
        if (cell.type !== 'tableCell' && cell.type !== 'tableHeader') {
          failUnsupported('node', cell.type);
        }
        const paragraphs = pmContent(cell.content);
        for (const paragraph of paragraphs) {
          if (paragraph.type !== 'tableParagraph') {
            failUnsupported('node', paragraph.type);
          }
        }
        return {
          type: 'tableCell' as const,
          props: record(cell.attrs),
          content: paragraphs.flatMap((paragraph) => inlineFromPm(pmContent(paragraph.content))),
        };
      }),
    };
  });
  const columnWidths = rows[0]?.cells.flatMap((cell) => {
    const value = cell.props.colwidth;
    return Array.isArray(value)
      ? value.filter((width): width is number => typeof width === 'number' && Number.isFinite(width) && width > 0)
      : [];
  });
  return {
    type: 'tableContent',
    ...(columnWidths && columnWidths.length > 0 ? { columnWidths } : {}),
    rows,
  };
}

function blockFromPm(container: PmJson): DurablePostBlock {
  if (container.type !== 'blockContainer') {
    failUnsupported('node', container.type);
  }
  const content = pmContent(container.content);
  const blockNode = content[0];
  if (!blockNode || typeof blockNode.type !== 'string' || !supportedBlocks.has(blockNode.type)) {
    failUnsupported('node', blockNode?.type);
  }
  const id = record(container.attrs).id;
  if (typeof id !== 'string' || !id) {
    throw new Error('Unsupported durable editor block without id');
  }
  const nestedGroup = content.slice(1).find((node) => node.type === 'blockGroup');
  if (content.slice(1).some((node) => node.type !== 'blockGroup')) {
    failUnsupported('node', content[1]?.type);
  }
  const props = isExecutableBlockType(blockNode.type)
    ? validateExecutableProps(blockNode.type, blockNode.attrs)
    : record(blockNode.attrs);
  return {
    id,
    type: blockNode.type,
    props,
    content:
      blockNode.type === 'table'
        ? tableFromPm(blockNode)
        : blockNode.type === 'shader'
          ? shaderContentFromPm(pmContent(blockNode.content))
          : isExecutableBlockType(blockNode.type)
            ? executableContentFromPm(pmContent(blockNode.content), blockNode.type)
            : inlineFromPm(pmContent(blockNode.content)),
    children: nestedGroup ? pmContent(nestedGroup.content).map(blockFromPm) : [],
  };
}

/** Reads the durable Yjs/ProseMirror wire through the official schema-aware decoder. */
function blocksFromYjs(fragment: Y.XmlFragment): DurablePostBlock[] {
  validatePersistedWire(fragment);
  const doc = yXmlFragmentToProseMirrorRootNode(fragment, postWireSchema).toJSON() as PmJson;
  if (doc.type !== 'doc') {
    failUnsupported('node', doc.type);
  }
  const groups = pmContent(doc.content);
  if (groups.length !== 1 || groups[0]?.type !== 'blockGroup') {
    failUnsupported('node', groups[0]?.type);
  }
  return pmContent(groups[0].content).map(blockFromPm);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function attr(name: string, value: unknown): string {
  return value === undefined || value === null || value === '' ? '' : ` ${name}="${escapeHtml(value)}"`;
}

function styleForBlock(props: Record<string, unknown>): string {
  const styles: string[] = [];
  if (typeof props.textAlignment === 'string' && props.textAlignment !== 'left') {
    styles.push(`text-align:${props.textAlignment}`);
  }
  if (typeof props.textColor === 'string' && props.textColor !== 'default') {
    styles.push(`color:${props.textColor}`);
  }
  if (typeof props.backgroundColor === 'string' && props.backgroundColor !== 'default') {
    styles.push(`background-color:${props.backgroundColor}`);
  }
  return styles.length ? ` style="${styles.join(';')}"` : '';
}

function inlineHtml(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'mathInline') {
        return `<span class="math-inline"${attr('data-latex', node.props?.latex)}>${escapeHtml(node.props?.latex)}</span>`;
      }
      if (node.type === 'link') {
        return `<a${attr('href', node.href)}>${inlineHtml(node.content ?? [])}</a>`;
      }
      if (node.type !== 'text') {
        failUnsupported('node', node.type);
      }
      let html = escapeHtml(node.text).replace(/\n/g, '<br>');
      for (const [style, enabled] of Object.entries(node.styles ?? {})) {
        if (!enabled) {
          continue;
        }
        if (style === 'bold') {
          html = `<strong>${html}</strong>`;
        } else if (style === 'italic') {
          html = `<em>${html}</em>`;
        } else if (style === 'underline') {
          html = `<u>${html}</u>`;
        } else if (style === 'strike') {
          html = `<s>${html}</s>`;
        } else if (style === 'code') {
          html = `<code>${html}</code>`;
        } else if (style === 'textColor') {
          html = `<span data-style-type="textColor" data-string-value="${escapeHtml(enabled)}">${html}</span>`;
        } else if (style === 'backgroundColor') {
          html = `<span data-style-type="backgroundColor" data-string-value="${escapeHtml(enabled)}">${html}</span>`;
        } else {
          failUnsupported('mark', style);
        }
      }
      return html;
    })
    .join('');
}

function withDom<T>(render: () => T): T {
  if (typeof document !== 'undefined') {
    return render();
  }
  const window = new JSDOM('').window;
  const hadDocument = Object.hasOwn(globalThis, 'document');
  const hadWindow = Object.hasOwn(globalThis, 'window');
  const previousDocument = Reflect.get(globalThis, 'document');
  const previousWindow = Reflect.get(globalThis, 'window');
  Reflect.set(globalThis, 'document', window.document);
  Reflect.set(globalThis, 'window', window);
  try {
    return render();
  } finally {
    if (hadDocument) {
      Reflect.set(globalThis, 'document', previousDocument);
    } else {
      Reflect.deleteProperty(globalThis, 'document');
    }
    if (hadWindow) {
      Reflect.set(globalThis, 'window', previousWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
    window.close();
  }
}

function mediaHtml(block: DurablePostBlock, entityId?: string): string {
  const p = block.props;
  const attachedFileId = p.fileId;
  const fileId = hasAttachedFileId(attachedFileId) ? attachedFileId.trim() : '';
  if (!fileId) {
    return '<div class="file-block-html file-block-html--empty"></div>';
  }
  if (String(p.mimeType ?? '').startsWith('image/')) {
    const url = String(p.url ?? '');
    if (!url) {
      return '<div class="image-block image-block--empty"></div>';
    }
    const style = mediaStyleToString(
      resolveMediaContainerStyle(String(p.previewWidth ?? '100'), String(p.textAlignment ?? 'left')),
    );
    return `<figure class="image-block file-block"${attr('style', style)}><img src="${escapeHtml(url)}" alt="${escapeHtml(p.alt)}" loading="lazy">${p.caption ? `<div class="media-block__caption" style="margin-top:0.5rem;font-size:0.6875rem;line-height:1.4;color:var(--mantine-color-dimmed);text-align:left;display:block;width:100%;min-height:20px">${escapeHtml(p.caption)}</div>` : ''}</figure>`;
  }
  if (String(p.mimeType ?? '').startsWith('audio/')) {
    if (!fileId) {
      return '<div class="audio-block audio-block--empty"></div>';
    }
    return withDom(
      () =>
        buildAudioMediaDom(
          resolveAudioViewModel({ ...p, fileId, processingStatus: 'ready' } as Parameters<
            typeof resolveAudioViewModel
          >[0]),
        ).outerHTML,
    );
  }
  if (String(p.mimeType ?? '').startsWith('video/')) {
    if (!fileId) {
      return '<div class="video-block video-block--empty"></div>';
    }
    return withDom(
      () =>
        buildVideoMediaDom(
          resolveVideoViewModel({ ...p, fileId, processingStatus: 'ready' } as Parameters<
            typeof resolveVideoViewModel
          >[0]),
        ).outerHTML,
    );
  }
  const name = String(p.name || p.fileName || 'Untitled file');
  const href = entityId
    ? buildContentScopedFileUrl({
        ownerType: 'post',
        ownerId: entityId,
        blockId: block.id,
        fileName: String(p.fileName || p.name || 'file'),
      })
    : String(p.url || '#');
  const style = mediaStyleToString(
    resolveMediaContainerStyle(String(p.previewWidth ?? '100'), String(p.textAlignment ?? 'left')),
  );
  const sizeText = formatMediaSize(String(p.size ?? ''));
  const meta = `<span class="attachment-meta">${escapeHtml(String(p.mimeType ?? '').includes('/') ? `${String(p.mimeType).split('/')[1]?.toUpperCase() || 'FILE'}${sizeText ? ` • ${sizeText}` : ''}` : 'FILE')}</span>`;
  return `<div class="attachment-block attachment-block-html file-block"${attr('data-file-id', fileId)}${attr('data-media-name', name)}${attr('data-block-alignment', normalizeMediaTextAlignment(String(p.textAlignment ?? 'left')))}${attr('style', style)}><a href="${escapeHtml(href)}" class="attachment-link"${attr('download', resolveMediaDownloadName({ name, mimeType: String(p.mimeType ?? ''), url: String(p.url ?? '') }))}><span class="attachment-title">${escapeHtml(name)}</span>${meta}</a>${p.caption ? `<div class="media-block__caption" style="margin-top:0.5rem;font-size:0.6875rem;line-height:1.4;color:var(--mantine-color-dimmed);text-align:left;display:block;width:100%;min-height:20px">${escapeHtml(p.caption)}</div>` : ''}</div>`;
}

function mapHtml(block: DurablePostBlock): string {
  const p = block.props;
  const ids = String(p.mapPlaceIds || '');
  const caption = String(p.caption || '');
  const style = mediaStyleToString(
    resolveMediaContainerStyle(String(p.previewWidth ?? '100'), String(p.textAlignment ?? 'left')),
  );
  const attrs = ids
    ? [
        attr('data-map-place-ids', ids),
        attr('data-aspect-ratio', p.aspectRatio || '16:9'),
        attr('data-preview-width', p.previewWidth),
        attr('data-zoom', p.zoom || '15'),
        attr('data-min-zoom', p.minZoom || DEFAULT_MAP_CONFIG.minZoom),
        attr('data-max-zoom', p.maxZoom || DEFAULT_MAP_CONFIG.maxZoom),
        attr('data-show-directions', p.showDirections || 'true'),
        attr('data-draggable', p.draggable || 'true'),
        attr('data-zoomable', p.zoomable || 'true'),
        attr('data-rotatable', p.rotatable || 'false'),
        attr('data-tiltable', p.tiltable || 'false'),
        attr('data-pin-clickable', p.pinClickable || 'true'),
        attr('data-center-lat', p.centerLat),
        attr('data-center-lng', p.centerLng),
        attr('data-pitch', p.pitch || '0'),
        attr('data-bearing', p.bearing || '0'),
        attr('data-show-3d-buildings', p.show3DBuildings || 'false'),
        attr('data-auto-rotate', p.autoRotate || 'false'),
        attr('data-auto-rotate-speed', p.autoRotateSpeed || '1'),
        attr('data-theme-id', p.themeId),
        attr('data-preferred-scheme', p.preferredScheme || 'auto'),
        attr('data-area-labels-mode', p.areaLabelsMode || 'inherit'),
        attr('data-poi-labels-mode', p.poiLabelsMode || 'inherit'),
        attr('data-caption', caption),
      ].join('')
    : '';
  const map = `<div class="map-block"${attr('data-block-alignment', p.textAlignment || 'left')}${caption ? '' : attr('style', style)}${attrs}>${ids ? `<p class="map-block__placeholder">[Map: ${ids.split(',').filter(Boolean).length} place${ids.split(',').filter(Boolean).length === 1 ? '' : 's'}]</p>` : ''}</div>`;
  return caption
    ? `<figure class="map-block-figure"${attr('style', style)}>${map}<figcaption>${escapeHtml(caption)}</figcaption></figure>`
    : map;
}

function tableHtml(content: Extract<DurablePostBlock['content'], { type: 'tableContent' }>): string {
  const widths = Array.isArray(content.columnWidths)
    ? content.columnWidths.filter((width) => Number.isFinite(width) && width > 0)
    : [];
  const total = widths.reduce((sum, width) => sum + width, 0);
  const colgroup =
    total > 0
      ? `<colgroup>${widths.map((width) => `<col style="width:${Math.round((width / total) * 1_000_000) / 10_000}%">`).join('')}</colgroup>`
      : '';
  const [headerRow, ...bodyRows] = content.rows;
  const rowHtml = (row: (typeof content.rows)[number], cellTag: 'th' | 'td') =>
    `<tr>${row.cells.map((cell) => `<${cellTag}${attr('colspan', cell.props.colspan)}${attr('rowspan', cell.props.rowspan)}>${inlineHtml(cell.content)}</${cellTag}>`).join('')}</tr>`;
  const head = headerRow ? `<thead>${rowHtml(headerRow, 'th')}</thead>` : '';
  return `<table>${colgroup}${head}<tbody>${bodyRows.map((row) => rowHtml(row, 'td')).join('')}</tbody></table>`;
}

function executableLanguage(block: DurablePostBlock): 'glsl' | 'javascript' | 'typescript' {
  if (block.type === 'shader') {
    return 'glsl';
  }
  if (block.type === 'threeScene') {
    return block.props.language === 'javascript' ? 'javascript' : 'typescript';
  }
  return 'javascript';
}

function executableSource(block: DurablePostBlock): string {
  const source = Array.isArray(block.content)
    ? block.content.map((node) => (node.type === 'text' ? (node.text ?? '') : '')).join('')
    : '';
  return source;
}

function shaderStages(block: DurablePostBlock): ShaderStageNode[] {
  if (block.type !== 'shader' || !Array.isArray(block.content)) {
    return [];
  }
  return block.content as ShaderStageNode[];
}

function executableSourceText(block: DurablePostBlock): string[] {
  if (block.type === 'shader') {
    return [
      ...shaderStages(block).map((stage) => stage.content.map((node) => node.text ?? '').join('')),
      ...block.children.flatMap(executableSourceText),
    ].filter(Boolean);
  }
  const canonicalSource = Array.isArray(block.content)
    ? block.content.map((node) => (node.type === 'text' ? (node.text ?? '') : '')).join('')
    : '';
  return [canonicalSource, ...block.children.flatMap(executableSourceText)].filter(Boolean);
}

function executableHtml(block: DurablePostBlock): string {
  const language = executableLanguage(block);
  const source = executableSource(block);
  const label = block.type === 'p5Sketch' ? 'p5.js sketch' : block.type === 'threeScene' ? 'Three.js scene' : 'Shader';
  const style = mediaStyleToString(
    resolveMediaContainerStyle(
      String(block.props.previewWidth ?? '100'),
      normalizeMediaTextAlignment(String(block.props.textAlignment ?? 'left')),
    ),
  );
  const sourceHtml =
    block.type === 'shader'
      ? shaderStages(block)
          .map((stage, index) => {
            const filename = SHADER_STAGES[index]![1];
            const stageSource = stage.content.map((node) => node.text ?? '').join('');
            const channels = stage.props?.channels;
            return `<section data-shader-stage="${escapeHtml(stage.type)}" data-shader-filename="${filename}"${channels ? attr('data-shader-channels', JSON.stringify(channels)) : ''}><h3>${filename}</h3><pre data-language="glsl"><code>${escapeHtml(stageSource)}</code></pre></section>`;
          })
          .join('')
      : `<pre data-language="${language}"><code>${escapeHtml(source)}</code></pre>`;
  return `<figure class="executable-block executable-block--${escapeHtml(block.type)}" data-content-type="${escapeHtml(block.type)}" data-language="${language}"${attr('data-preview-height', block.props.previewHeight ?? 360)} data-mode="preview"${attr('style', style)}><figcaption>${label}</figcaption>${sourceHtml}</figure>`;
}

function blockHtml(block: DurablePostBlock, entityId?: string): string {
  const inline = Array.isArray(block.content) ? block.content : [];
  let html: string;
  switch (block.type) {
    case 'paragraph':
      html = `<p${styleForBlock(block.props)}>${inlineHtml(inline)}</p>`;
      break;
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(block.props.level) || 1));
      html = `<h${level}${styleForBlock(block.props)}>${inlineHtml(inline)}</h${level}>`;
      break;
    }
    case 'bulletListItem':
      html = `<ul><li${styleForBlock(block.props)}>${inlineHtml(inline)}</li></ul>`;
      break;
    case 'numberedListItem':
      html = `<ol${Number(block.props.start) > 1 ? attr('start', block.props.start) : ''}><li${styleForBlock(block.props)}>${inlineHtml(inline)}</li></ol>`;
      break;
    case 'checkListItem':
      html = `<ul><li data-checked="${block.props.checked === true ? 'true' : 'false'}"${styleForBlock(block.props)}>${inlineHtml(inline)}</li></ul>`;
      break;
    case 'quote':
      html = `<blockquote${styleForBlock(block.props)}>${inlineHtml(inline)}</blockquote>`;
      break;
    case 'callout': {
      const icon = escapeHtml(String(block.props.icon || '💡'));
      const backgroundColor = escapeHtml(String(block.props.backgroundColor || 'gray'));
      const textColor = escapeHtml(String(block.props.textColor || 'default'));
      return `<aside data-callout="" data-bg-color="${backgroundColor}" data-text-color="${textColor}"><span data-callout-icon="" aria-hidden="true">${icon}</span><div data-callout-content=""><div data-callout-copy="">${inlineHtml(inline)}</div>${block.children.map((child) => blockHtml(child, entityId)).join('')}</div></aside>`;
    }
    case 'codeBlock':
      html = `<pre data-language="${escapeHtml(block.props.language || 'javascript')}"${attr('data-preview-width', block.props.previewWidth ?? '100')}${attr(
        'data-text-alignment',
        block.props.textAlignment ?? 'left',
      )}${attr(
        'style',
        mediaStyleToString(
          resolveMediaContainerStyle(
            String(block.props.previewWidth ?? '100'),
            normalizeMediaTextAlignment(String(block.props.textAlignment ?? 'left')),
          ),
        ),
      )}><code>${escapeHtml(inline.map((node) => (node.type === 'text' ? (node.text ?? '') : '')).join(''))}</code></pre>`;
      break;
    case 'p5Sketch':
    case 'threeScene':
    case 'shader':
      html = executableHtml(block);
      break;
    case 'divider':
      html = '<hr>';
      break;
    case 'math':
      html = `<div class="math-block"${attr('data-latex', block.props.latex)}>${escapeHtml(block.props.latex)}</div>`;
      break;
    case 'table':
      html = tableHtml(block.content as Extract<DurablePostBlock['content'], { type: 'tableContent' }>);
      break;
    case 'map':
      html = mapHtml(block);
      break;
    case 'file':
      html = mediaHtml(block, entityId);
      break;
    default:
      failUnsupported('node', block.type);
  }
  return `${html}${block.children.map((child) => blockHtml(child, entityId)).join('')}`;
}

function inlineMarkdown(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'mathInline') {
        return `$${unescapeLatex(String(node.props?.latex ?? ''))}$`;
      }
      if (node.type === 'link') {
        const label = inlineMarkdown(node.content ?? []);
        return label === node.href ? String(node.href) : `[${label}](${node.href})`;
      }
      if (node.type !== 'text') {
        failUnsupported('node', node.type);
      }
      let value = node.text ?? '';
      const s = node.styles ?? {};
      if (s.bold) {
        value = `**${value}**`;
      }
      if (s.italic) {
        value = `*${value}*`;
      }
      if (s.strike) {
        value = `~~${value}~~`;
      }
      if (s.code) {
        value = `\`${value}\``;
      }
      return value;
    })
    .join('');
}

function fencedCode(language: string, source: string): string {
  const longestBacktickRun = Math.max(0, ...Array.from(source.matchAll(/`+/g), (match) => match[0].length));
  const fence = '`'.repeat(Math.max(3, longestBacktickRun + 1));
  return `${fence}${language}\n${source}\n${fence}`;
}

function blockMarkdown(block: DurablePostBlock, entityId: string): string {
  const inline = block.type !== 'shader' && Array.isArray(block.content) ? inlineMarkdown(block.content) : '';
  let markdown: string;
  switch (block.type) {
    case 'paragraph':
      markdown = inline;
      break;
    case 'heading':
      markdown = `${'#'.repeat(Math.min(6, Math.max(1, Number(block.props.level) || 1)))} ${inline}`;
      break;
    case 'bulletListItem':
      markdown = `- ${inline}`;
      break;
    case 'numberedListItem':
      markdown = `${Number(block.props.start) || 1}. ${inline}`;
      break;
    case 'checkListItem':
      markdown = `- [${block.props.checked ? 'x' : ' '}] ${inline}`;
      break;
    case 'quote':
      markdown = `> ${inline}`;
      break;
    case 'callout': {
      const content = [inline, ...block.children.map((child) => blockMarkdown(child, entityId)).filter(Boolean)]
        .filter(Boolean)
        .join('\n\n');
      const icon = String(block.props.icon || '💡');
      return `> ${icon}${content ? ` ${content.replaceAll('\n', '\n> ')}` : ''}`;
    }
    case 'codeBlock':
      markdown = fencedCode(
        String(block.props.language || ''),
        Array.isArray(block.content)
          ? block.content.map((node) => (node.type === 'text' ? (node.text ?? '') : '')).join('')
          : '',
      );
      break;
    case 'p5Sketch':
    case 'threeScene':
      markdown = fencedCode(executableLanguage(block), executableSource(block));
      break;
    case 'shader': {
      markdown = shaderStages(block)
        .flatMap((stage, index) => {
          const source = stage.content.map((node) => node.text ?? '').join('');
          return source ? [`### ${SHADER_STAGES[index]![1]}\n\n${fencedCode('glsl', source)}`] : [];
        })
        .join('\n\n');
      break;
    }
    case 'divider':
      markdown = '---';
      break;
    case 'math':
      markdown = `$$${unescapeLatex(String(block.props.latex ?? ''))}$$`;
      break;
    case 'table': {
      const rows = (block.content as Extract<DurablePostBlock['content'], { type: 'tableContent' }>).rows;
      markdown = rows.length
        ? [
            `| ${rows[0].cells.map((cell) => inlineMarkdown(cell.content)).join(' | ')} |`,
            `| ${rows[0].cells.map(() => '---').join(' | ')} |`,
            ...rows.slice(1).map((row) => `| ${row.cells.map((cell) => inlineMarkdown(cell.content)).join(' | ')} |`),
          ].join('\n')
        : '';
      break;
    }
    case 'file': {
      if (!hasAttachedFileId(block.props.fileId)) {
        markdown = '';
        break;
      }
      const name = String(block.props.fileName || block.props.name || 'file');
      markdown = `[${name}](${buildContentScopedFileUrl({ ownerType: 'post', ownerId: entityId, blockId: block.id, fileName: name })})`;
      break;
    }
    case 'map':
      markdown = '';
      break;
    default:
      failUnsupported('node', block.type);
  }
  return [markdown, ...block.children.map((child) => blockMarkdown(child, entityId))].filter(Boolean).join('\n\n');
}

async function htmlFromBlocks(
  blocks: DurablePostBlock[],
  entityId?: string,
  requestedLocale?: string | null,
): Promise<string> {
  const raw = normalizeRichTextHtmlLinksFromBlocks(blocks, blocks.map((block) => blockHtml(block, entityId)).join(''));
  const headings = extractHeadings(blocks);
  return injectMapData(await applyCodeHighlighting(applyMathRendering(addHeadingIds(raw, headings))), requestedLocale);
}

/** Converts cached materialized block JSON without loading an editor runtime. */
export async function blocksToHtml(blocks: unknown[], requestedLocale?: string | null): Promise<string> {
  const durable = blocks.map((block) => validateLooseBlock(block));
  return htmlFromBlocks(durable, undefined, requestedLocale);
}

function validateLooseBlock(value: unknown): DurablePostBlock {
  const block = record(value);
  if (typeof block.id !== 'string' || typeof block.type !== 'string' || !supportedBlocks.has(block.type)) {
    failUnsupported('node', block.type);
  }
  const children = Array.isArray(block.children) ? block.children.map(validateLooseBlock) : [];
  const content = block.content;
  if (block.type === 'table') {
    const table = record(content);
    if (table.type !== 'tableContent' || !Array.isArray(table.rows)) {
      throw new Error('Unsupported durable editor table content');
    }
  } else if (content !== undefined && !Array.isArray(content)) {
    throw new Error(`Unsupported durable editor ${block.type} content`);
  } else if (block.type === 'shader' && Array.isArray(content)) {
    const stages = content.map(record);
    if (
      stages.length !== SHADER_STAGES.length ||
      stages.some((stage, index) => stage.type !== SHADER_STAGES[index]![0])
    ) {
      throw new Error('Invalid durable editor shader stage content');
    }
    for (const [index, stage] of stages.entries()) {
      const stageContent = stage.content;
      if (!Array.isArray(stageContent)) {
        throw new Error('Invalid durable editor shader stage content');
      }
      for (const node of stageContent) {
        const item = record(node);
        if (
          item.type !== 'text' ||
          typeof item.text !== 'string' ||
          (item.styles !== undefined && Object.keys(record(item.styles)).length > 0)
        ) {
          throw new Error('Invalid durable editor shader source content');
        }
      }
      const props = record(stage.props);
      const channelStage = index >= 2;
      if (channelStage) {
        if (Object.keys(props).some((key) => key !== 'channels')) {
          throw new Error('Invalid durable editor shader stage attributes');
        }
        shaderChannels(props.channels);
      } else if (Object.keys(props).length > 0) {
        throw new Error('Invalid durable editor shader stage attributes');
      }
    }
    assertShaderBufferDag(content as ShaderStageNode[]);
  } else if (isExecutableBlockType(block.type) && Array.isArray(content)) {
    for (const node of content) {
      const item = record(node);
      if (
        item.type !== 'text' ||
        typeof item.text !== 'string' ||
        (item.styles !== undefined && Object.keys(record(item.styles)).length > 0)
      ) {
        throw new Error(`Invalid durable editor ${block.type} source content`);
      }
    }
  }
  return {
    id: block.id,
    type: block.type,
    props: isExecutableBlockType(block.type) ? validateExecutableProps(block.type, block.props) : record(block.props),
    content: content as DurablePostBlock['content'],
    children,
  };
}

export async function convertPostContent(yjsState: Buffer, entityId: string): Promise<ConvertedContent> {
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, yjsState);
    const blocks = blocksFromYjs(doc.getXmlFragment('document-store'));
    return {
      json: blocks,
      html: await htmlFromBlocks(blocks, entityId),
      markdown:
        blocks
          .map((block) => blockMarkdown(block, entityId))
          .filter(Boolean)
          .join('\n\n') + (blocks.length ? '\n' : ''),
      text: [extractText(blocks), ...blocks.flatMap(executableSourceText)].filter(Boolean).join(' '),
    };
  } finally {
    doc.destroy();
  }
}
