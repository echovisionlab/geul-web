'use client';

import { useCallback } from 'react';
import katex from 'katex';
import { useTranslations } from 'next-intl';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { normalizeRichTextHref } from '@echovisionlab/geul-common/editor/link-normalization';
import { hasAttachedFileId } from '@echovisionlab/geul-common/media/block-schemas';
import {
  ContentBlockDownloadAction,
  ContentBlockDownloadAvailability,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { FileDownloadAction, FileDownloadAvailability } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { richTextBlockKindByProtoCase } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { AudioMediaView } from '@/features/media/AudioMediaView';
import { VideoMediaView } from '@/features/media/VideoMediaView';
import { AttachmentMediaView } from '@/features/media/ui/AttachmentMediaView';
import { ImageMediaView } from '@/features/media/ui/ImageMediaView';
import { MissingMediaView, type MissingMediaKind } from '@/features/media/ui/MissingMediaView';
import { AuthorizedDownloadAction } from '@/features/media-download/AuthorizedDownloadAction';
import { useContentMediaDelivery } from '@/features/media/ContentMediaDeliveryContext';
import { useOptionalContentBlockMediaRuntime } from '@/features/media/ContentBlockMediaRuntimeContext';
import {
  SHADER_STAGE_DEFINITIONS,
  validateShaderPassGraph,
  type ShaderChannel,
  type ShaderProgramDocument,
  type ShaderSamplerOptions,
} from '@/features/editor/tiptap/shader/shader-program';
import type { ShaderAssetResolver } from '@/features/editor/tiptap/shader/shader-preview-runtime';
import { MapView } from '@/features/page/blocks/map/View';
import { PublicExecutableBlockView } from './PublicExecutableBlockView';
import { resolveAudioViewModelFromBlock } from '@/lib/media/audio-view-model';
import {
  formatMediaSize,
  getBlockPropString,
  mediaContainerStyleToReact,
  resolveMediaContainerStyle,
} from '@/lib/media/shared';
import { resolveVideoViewModelFromBlock } from '@/lib/media/video-view-model';
import type { Block, InlineContent } from '@/lib/types/page-content';
import { getFileTypeName } from '@/lib/utils/file-icon';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { getCodeBlockLanguageName, resolveCodeBlockLanguage } from '@/lib/editor/code-block-options';
import { CodeBlockSurface } from '@/features/editor/tiptap/code/CodeBlockSurface';
import { normalizeP5Capabilities } from '@/features/editor/tiptap/p5/p5-capabilities';
import { assertNever, requireRichTextBlockKind } from '@/features/editor/contract/block-registry';
import { isBlockId } from '@/lib/editor/block-id';

interface DefaultBlockViewProps {
  block: Block;
  requestedLocale?: string;
}

function hasOwn<TObject extends object>(value: TObject, key: PropertyKey): key is keyof TObject {
  return Object.hasOwn(value, key);
}

function publicRichTextKind(value: string) {
  return requireRichTextBlockKind(
    hasOwn(richTextBlockKindByProtoCase, value) ? richTextBlockKindByProtoCase[value] : value,
  );
}

function getInlineHref(item: InlineContent): string | undefined {
  if (item.props?.href && typeof item.props.href === 'string') {
    return item.props.href;
  }

  if ('href' in item && typeof (item as { href?: unknown }).href === 'string') {
    return (item as { href: string }).href;
  }

  return undefined;
}

export function DefaultBlockView({ block, requestedLocale }: DefaultBlockViewProps) {
  const kind = publicRichTextKind(block.type);
  if (block.type === 'file' && !hasAttachedFileId(block.props.fileId)) {
    return null;
  }
  const missingMediaKind = resolveMissingMediaKind(block);
  if (missingMediaKind) {
    return <MissingMediaBlock block={block} kind={missingMediaKind} />;
  }

  switch (kind) {
    case 'paragraph':
      return <ParagraphBlock block={block} />;
    case 'heading':
      return <HeadingBlock block={block} />;
    case 'bullet-list-item':
      return <BulletListItem block={block} requestedLocale={requestedLocale} />;
    case 'numbered-list-item':
      return <NumberedListItem block={block} requestedLocale={requestedLocale} />;
    case 'check-list-item':
      return <CheckListItem block={block} />;
    case 'quote':
      return <QuoteBlock block={block} />;
    case 'callout':
      return <CalloutBlock block={block} requestedLocale={requestedLocale} />;
    case 'divider':
      return <DividerBlock />;
    case 'map':
      return <MapBlockView block={block} requestedLocale={requestedLocale} />;
    case 'math':
      return <MathBlockView block={block} />;
    case 'code-block':
      return <CodeBlock block={block} />;
    case 'p5-sketch':
    case 'three-scene':
    case 'shader':
      return <ExecutableCodeBlock block={block} />;
    case 'table':
      return <TableBlock block={block} />;
    case 'file': {
      const fileKind = resolveUnifiedFileViewKind(block);
      if (fileKind === 'image') {
        return <ImageBlock block={block} />;
      }
      if (fileKind === 'audio') {
        return <AudioBlock block={block} />;
      }
      if (fileKind === 'video') {
        return <VideoBlock block={block} />;
      }
      return <AttachmentBlockView block={block} />;
    }
    default:
      return assertNever(kind, 'Unsupported public rich-text Block kind');
  }
}

export type UnifiedFileViewKind = 'image' | 'audio' | 'video' | 'file';

export function resolveUnifiedFileViewKind(block: Block): UnifiedFileViewKind {
  const mimeType = getBlockPropString(block.props, 'mimeType').trim().toLowerCase();
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  return 'file';
}

export function resolveMissingMediaKind(block: Block): MissingMediaKind | null {
  if (block.props.mediaMissing !== true) {
    return null;
  }

  switch (block.type) {
    case 'file':
      return resolveUnifiedFileViewKind(block);
    default:
      return null;
  }
}

function MissingMediaBlock({ block, kind }: { block: Block; kind: MissingMediaKind }) {
  const t = useTranslations('mediaCommon.missing');
  const messageKey = {
    file: 'fileDeleted',
    image: 'imageDeleted',
    video: 'videoDeleted',
    audio: 'audioDeleted',
  }[kind] as 'fileDeleted' | 'imageDeleted' | 'videoDeleted' | 'audioDeleted';

  return (
    <MissingMediaView
      kind={kind}
      message={t(messageKey)}
      caption={getBlockPropString(block.props, 'caption')}
      style={getContainerStyle(block)}
    />
  );
}

function getContainerStyle(block: Block): React.CSSProperties {
  return (
    mediaContainerStyleToReact(
      resolveMediaContainerStyle(
        getBlockPropString(block.props, 'previewWidth', '100'),
        getBlockPropString(block.props, 'textAlignment', 'left'),
      ),
    ) || {}
  );
}

function renderTextWithSoftBreaks(text: string, keyPrefix: string): React.ReactNode {
  if (!text.includes('\n')) {
    return text;
  }

  return text
    .split('\n')
    .flatMap((part, index) => (index === 0 ? [part] : [<br key={`${keyPrefix}-br-${index}`} />, part]));
}

// Render inline content (text with styles)
function renderInlineContent(content: InlineContent[] | undefined): React.ReactNode {
  if (!content || content.length === 0) {
    return null;
  }

  return content.map((item, index) => {
    if (item.type === 'text') {
      let element: React.ReactNode = renderTextWithSoftBreaks(item.text || '', `text-${index}`);

      // Apply styles
      if (item.styles) {
        if (item.styles.bold) {
          element = <strong key={index}>{element}</strong>;
        }
        if (item.styles.italic) {
          element = <em key={index}>{element}</em>;
        }
        if (item.styles.underline) {
          element = <u key={index}>{element}</u>;
        }
        if (item.styles.strikethrough) {
          element = <s key={index}>{element}</s>;
        }
        if (item.styles.code) {
          element = <code key={index}>{element}</code>;
        }
        if (item.styles.textColor) {
          element = (
            <span key={index} data-text-color={item.styles.textColor}>
              {element}
            </span>
          );
        }
        if (item.styles.backgroundColor) {
          element = (
            <span key={index} data-bg-color={item.styles.backgroundColor}>
              {element}
            </span>
          );
        }
      }

      return <span key={index}>{element}</span>;
    }

    if (item.type === 'link') {
      const href = normalizeRichTextHref(getInlineHref(item) ?? '');
      if (!href) {
        return renderInlineContent(item.content);
      }

      return (
        <a key={index} href={href} target="_blank" rel="noopener noreferrer">
          {renderInlineContent(item.content)}
        </a>
      );
    }

    if (item.type === 'mathInline') {
      let html = item.props?.latex as string;
      try {
        html = katex.renderToString(item.props?.latex as string, {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        // fallback to raw latex
      }
      return <span key={index} className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />;
    }

    return null;
  });
}

function ParagraphBlock({ block }: { block: Block }) {
  const alignment = (block.props.textAlignment as string) || 'left';
  return <p style={{ textAlign: alignment as 'left' | 'center' | 'right' }}>{renderInlineContent(block.content)}</p>;
}

function HeadingBlock({ block }: { block: Block }) {
  const level = (block.props.level as number) || 1;
  const alignment = (block.props.textAlignment as string) || 'left';
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

  return (
    <Tag id={block.id} style={{ textAlign: alignment as 'left' | 'center' | 'right' }}>
      {renderInlineContent(block.content)}
    </Tag>
  );
}

function QuoteBlock({ block }: { block: Block }) {
  const alignment = (block.props.textAlignment as string) || 'left';
  return (
    <blockquote style={{ textAlign: alignment as 'left' | 'center' | 'right' }}>
      {renderInlineContent(block.content)}
    </blockquote>
  );
}

function CalloutBlock({ block, requestedLocale }: { block: Block; requestedLocale?: string }) {
  return (
    <aside
      data-callout=""
      data-bg-color={getBlockPropString(block.props, 'backgroundColor') || 'gray'}
      data-text-color={getBlockPropString(block.props, 'textColor') || 'default'}
    >
      <span data-callout-icon="" aria-hidden="true">
        {getBlockPropString(block.props, 'icon') || '💡'}
      </span>
      <div data-callout-content="">
        <div data-callout-copy="">{renderInlineContent(block.content)}</div>
        {(block.children ?? []).map((child) => (
          <DefaultBlockView key={child.id} block={child} requestedLocale={requestedLocale} />
        ))}
      </div>
    </aside>
  );
}

function BulletListItem({ block, requestedLocale }: { block: Block; requestedLocale?: string }) {
  return (
    <ul>
      <li>
        {renderInlineContent(block.content)}
        {block.children && block.children.length > 0 && (
          <ul>
            {block.children.map((child) => (
              <DefaultBlockView key={child.id} block={child} requestedLocale={requestedLocale} />
            ))}
          </ul>
        )}
      </li>
    </ul>
  );
}

function NumberedListItem({ block, requestedLocale }: { block: Block; requestedLocale?: string }) {
  return (
    <ol>
      <li>
        {renderInlineContent(block.content)}
        {block.children && block.children.length > 0 && (
          <ol>
            {block.children.map((child) => (
              <DefaultBlockView key={child.id} block={child} requestedLocale={requestedLocale} />
            ))}
          </ol>
        )}
      </li>
    </ol>
  );
}

function CheckListItem({ block }: { block: Block }) {
  const checked = (block.props.checked as boolean) || false;
  return (
    <div className="check-list-item">
      <input type="checkbox" checked={checked} readOnly />
      <span>{renderInlineContent(block.content)}</span>
    </div>
  );
}

function DividerBlock() {
  return <hr />;
}

function ImageBlock({ block }: { block: Block }) {
  const url = getBlockPropString(block.props, 'url');
  const alt = getBlockPropString(block.props, 'alt');
  const caption = getBlockPropString(block.props, 'caption');
  const name = getBlockPropString(block.props, 'name');

  if (!url) {
    return null;
  }

  return (
    <ImageMediaView
      src={buildManagedImageUrl(url, MANAGED_IMAGE_PRESET.CONTENT_IMAGE) ?? url}
      alt={alt || name || caption || 'Image'}
      caption={caption}
      style={getContainerStyle(block)}
      action={<BlockDownloadAction block={block} title={name || alt || caption || 'Image'} presentation="icon" />}
    />
  );
}

function MathBlockView({ block }: { block: Block }) {
  const latex = getBlockPropString(block.props, 'latex');
  if (!latex) {
    return null;
  }

  let html = latex;
  try {
    html = katex.renderToString(latex, {
      displayMode: true,
      throwOnError: false,
    });
  } catch {
    // fallback to raw latex
  }

  return <div className="math-block" data-latex={latex} dangerouslySetInnerHTML={{ __html: html }} />;
}

function MapBlockView({ block, requestedLocale }: { block: Block; requestedLocale?: string }) {
  return <MapView props={block.props} requestedLocale={requestedLocale} />;
}

function VideoBlock({ block }: { block: Block }) {
  const model = resolveVideoViewModelFromBlock(block);
  if (!model.hlsUrl && !model.playbackUrl && !getBlockPropString(block.props, 'fileId')) {
    return null;
  }
  return (
    <VideoMediaView
      model={model}
      style={model.containerStyle || getContainerStyle(block)}
      playerAction={<BlockDownloadAction block={block} title={model.title} presentation="icon" />}
    />
  );
}

function AudioBlock({ block }: { block: Block }) {
  const model = resolveAudioViewModelFromBlock(block);
  if (!model.playbackUrl && !getBlockPropString(block.props, 'fileId')) {
    return null;
  }
  return (
    <AudioMediaView
      model={model}
      style={model.containerStyle || getContainerStyle(block)}
      playerAction={<BlockDownloadAction block={block} title={model.title} presentation="icon" />}
    />
  );
}

function CodeBlock({ block }: { block: Block }) {
  const editorMessages = useTranslations('editorCommon.editor');
  const commonActions = useTranslations('common.actions');
  const commonLabels = useTranslations('common.labels');
  const language = (block.props.language as string) || 'text';
  const resolvedLanguage = resolveCodeBlockLanguage(language);
  const title = getBlockPropString(block.props, 'title');
  const code = block.content?.map((c) => c.text || '').join('') || '';

  return (
    <figure data-content-type="codeBlock" style={getContainerStyle(block)}>
      <div
        data-language={language}
        data-preview-width={getBlockPropString(block.props, 'previewWidth', '100')}
        data-text-alignment={String(block.props.textAlignment || 'left')}
      >
        <CodeBlockSurface
          title={title}
          fallbackTitle={editorMessages('slashMenu.items.codeBlock.title')}
          titleLabel={commonLabels('title')}
          languageName={getCodeBlockLanguageName(language)}
          source={code}
          sourceLabel={commonLabels('source')}
          copyLabel={commonActions('copy')}
          monacoLanguage={resolvedLanguage.monacoLanguage}
          modelPath={`public/code/${encodeURIComponent(block.id)}.${resolvedLanguage.fileExtension}`}
        />
      </div>
    </figure>
  );
}

function executableLanguage(block: Block): 'glsl' | 'javascript' | 'typescript' {
  if (block.type === 'shader') {
    return 'glsl';
  }
  if (block.type === 'threeScene') {
    return block.props.language === 'javascript' ? 'javascript' : 'typescript';
  }
  return 'javascript';
}

function executableSource(block: Block): string {
  const source = block.content?.map((node) => (node.type === 'text' ? (node.text ?? '') : '')).join('') ?? '';
  if (source) {
    return source;
  }
  return block.type === 'p5Sketch' || block.type === 'threeScene' ? getBlockPropString(block.props, 'source') : '';
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function shaderSampler(value: unknown): ShaderSamplerOptions | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  return exactKeys(candidate, ['filter', 'vflip', 'wrap']) &&
    (candidate.filter === 'nearest' || candidate.filter === 'linear') &&
    (candidate.wrap === 'clamp' || candidate.wrap === 'repeat') &&
    typeof candidate.vflip === 'boolean'
    ? (candidate as unknown as ShaderSamplerOptions)
    : null;
}

function shaderChannel(value: unknown): ShaderChannel | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === 'none' && exactKeys(candidate, ['kind'])) {
    return { kind: 'none' };
  }
  if (
    candidate.kind === 'buffer' &&
    exactKeys(candidate, ['buffer', 'kind']) &&
    ['A', 'B', 'C', 'D'].includes(String(candidate.buffer))
  ) {
    return { kind: 'buffer', buffer: candidate.buffer as 'A' | 'B' | 'C' | 'D' };
  }
  const sampler = shaderSampler(candidate.sampler);
  if (!sampler) {
    return null;
  }
  if (
    (candidate.kind === 'textureFile' || candidate.kind === 'videoFile') &&
    exactKeys(candidate, ['fileId', 'kind', 'sampler']) &&
    typeof candidate.fileId === 'string' &&
    candidate.fileId
  ) {
    return { kind: candidate.kind, fileId: candidate.fileId, sampler };
  }
  if (
    candidate.kind === 'cubemapFiles' &&
    exactKeys(candidate, ['fileIds', 'kind', 'sampler']) &&
    Array.isArray(candidate.fileIds) &&
    candidate.fileIds.length === 6 &&
    candidate.fileIds.every((fileId) => typeof fileId === 'string' && fileId)
  ) {
    return {
      kind: 'cubemapFiles',
      fileIds: candidate.fileIds as [string, string, string, string, string, string],
      sampler,
    };
  }
  if (candidate.kind === 'cubemapPass' && exactKeys(candidate, ['kind', 'sampler'])) {
    return { kind: 'cubemapPass', sampler };
  }
  return null;
}

function shaderProgramFromBlock(block: Block): ShaderProgramDocument | null {
  const stages = block.content ?? [];
  if (stages.length !== SHADER_STAGE_DEFINITIONS.length) {
    return null;
  }
  const sources = {} as ShaderProgramDocument['sources'];
  const channels: ShaderProgramDocument['channels'] = {};
  for (const [index, [stage, nodeName]] of SHADER_STAGE_DEFINITIONS.entries()) {
    const rawStage = stages[index] as unknown;
    if (!rawStage || typeof rawStage !== 'object' || Array.isArray(rawStage)) {
      return null;
    }
    const candidate = rawStage as Record<string, unknown>;
    if (candidate.type !== nodeName || !Array.isArray(candidate.content)) {
      return null;
    }
    const sourceParts: string[] = [];
    for (const rawText of candidate.content) {
      if (!rawText || typeof rawText !== 'object' || Array.isArray(rawText)) {
        return null;
      }
      const text = rawText as Record<string, unknown>;
      const styles = text.styles;
      if (
        text.type !== 'text' ||
        typeof text.text !== 'string' ||
        (styles !== undefined && (!styles || typeof styles !== 'object' || Object.keys(styles).length > 0))
      ) {
        return null;
      }
      sourceParts.push(text.text);
    }
    sources[stage] = sourceParts.join('');
    if (index >= 2) {
      const props = candidate.props;
      if (
        !props ||
        typeof props !== 'object' ||
        Array.isArray(props) ||
        !exactKeys(props as Record<string, unknown>, ['channels'])
      ) {
        return null;
      }
      const rawChannels = (props as Record<string, unknown>).channels;
      if (!Array.isArray(rawChannels) || rawChannels.length !== 4) {
        return null;
      }
      const parsed = rawChannels.map(shaderChannel);
      if (parsed.some((channel) => channel === null)) {
        return null;
      }
      channels[stage as keyof typeof channels] = parsed as ShaderChannel[];
    } else if (
      candidate.props !== undefined &&
      (!candidate.props || typeof candidate.props !== 'object' || Object.keys(candidate.props).length > 0)
    ) {
      return null;
    }
  }
  const program = { sources, channels };
  return validateShaderPassGraph(program) ? null : program;
}

function ExecutableCodeBlock({ block }: { block: Block }) {
  const mediaDelivery = useContentMediaDelivery();
  const resolveShaderAsset = useCallback<ShaderAssetResolver>(
    (fileId, kind) => resolveShaderMediaAsset(mediaDelivery, fileId, kind),
    [mediaDelivery],
  );
  const language = executableLanguage(block);
  const commonProps = {
    blockId: block.id,
    title: getBlockPropString(block.props, 'title'),
    previewHeight: Number(getBlockPropString(block.props, 'previewHeight', '360')),
    style: getContainerStyle(block),
  };
  if (block.type === 'shader') {
    const program = shaderProgramFromBlock(block);
    return program ? (
      <PublicExecutableBlockView
        {...commonProps}
        type="shader"
        language="glsl"
        program={program}
        resolveAsset={resolveShaderAsset}
      />
    ) : (
      <div data-invalid-executable-block="shader" />
    );
  }
  return (
    <PublicExecutableBlockView
      {...commonProps}
      type={block.type as 'p5Sketch' | 'threeScene'}
      source={executableSource(block)}
      language={language}
      {...(block.type === 'p5Sketch'
        ? {
            capabilities: normalizeP5Capabilities(block.props.capabilities),
          }
        : {})}
    />
  );
}

export async function resolveShaderMediaAsset(
  mediaDelivery: ReturnType<typeof useContentMediaDelivery>,
  fileId: string,
  kind: 'image' | 'video',
) {
  if (!mediaDelivery) {
    throw new Error('Shader media delivery is unavailable.');
  }
  const url = await mediaDelivery.resolveAsset(fileId, kind);
  if (!url?.trim()) {
    throw new Error(`Shader ${kind} file is unavailable.`);
  }
  return { fileId, kind, url } as const;
}

function TableBlock({ block }: { block: Block }) {
  const durableContent = block.content as unknown as
    | {
        type: 'tableContent';
        columnWidths?: number[];
        rows: Array<{ cells: Array<{ content: InlineContent[] }> }>;
      }
    | undefined;
  const legacyContent = block.props.content as { rows: { cells: InlineContent[][] }[] } | undefined;
  const rows =
    durableContent?.type === 'tableContent'
      ? durableContent.rows.map((row) => ({ cells: row.cells.map((cell) => cell.content) }))
      : legacyContent?.rows;

  if (!rows) {
    return null;
  }

  const [headerRow, ...bodyRows] = rows;

  return (
    <table style={getContainerStyle(block)}>
      {durableContent?.columnWidths?.length ? (
        <colgroup>
          {durableContent.columnWidths.map((width, index) => (
            <col key={index} style={{ width: `${width}%` }} />
          ))}
        </colgroup>
      ) : null}
      {headerRow ? (
        <thead>
          <tr>
            {headerRow.cells.map((cell, cellIndex) => (
              <th key={cellIndex}>{renderInlineContent(cell)}</th>
            ))}
          </tr>
        </thead>
      ) : null}
      <tbody>
        {bodyRows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.cells.map((cell, cellIndex) => (
              <td key={cellIndex}>{renderInlineContent(cell)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AttachmentBlockView({ block }: { block: Block }) {
  const tMedia = useTranslations('editorCommon.media');
  const caption = getBlockPropString(block.props, 'caption');
  const name = getBlockPropString(block.props, 'name');
  const displayName = name || tMedia('attachmentEditor.untitledFile');
  const mimeType = getBlockPropString(block.props, 'mimeType') || 'application/octet-stream';
  const sizeText = formatMediaSize(getBlockPropString(block.props, 'size'));

  const typeLabel = getFileTypeName(mimeType);
  const meta = [typeLabel, sizeText].filter(Boolean).join(' · ');

  return (
    <AttachmentMediaView
      title={<span className="attachment-title">{displayName}</span>}
      meta={meta}
      caption={caption}
      style={getContainerStyle(block)}
      action={<BlockDownloadAction block={block} title={displayName} presentation="icon" />}
    />
  );
}

function BlockDownloadAction({
  block,
  title,
  presentation = 'button',
}: {
  block: Block;
  title: string;
  presentation?: 'button' | 'icon';
}) {
  const contentMedia = useContentMediaDelivery();
  const runtimeIndex = useOptionalContentBlockMediaRuntime();
  const runtime = runtimeIndex && isBlockId(block.id) ? runtimeIndex.get(block.id, 'file') : undefined;
  const fileName = getBlockPropString(block.props, 'name') || title;
  const delivery = runtime?.delivery;
  const initialDownloadExpiresAt = delivery?.download?.expiresAt
    ? timestampDate(delivery.download.expiresAt).toISOString()
    : undefined;

  if (!runtime || !contentMedia) {
    return null;
  }

  const availability =
    runtime.downloadAvailability === ContentBlockDownloadAvailability.AVAILABLE
      ? FileDownloadAvailability.AVAILABLE
      : runtime.downloadAvailability === ContentBlockDownloadAvailability.UNAVAILABLE
        ? FileDownloadAvailability.UNAVAILABLE
        : FileDownloadAvailability.UNSPECIFIED;
  const action =
    runtime.downloadAction === ContentBlockDownloadAction.DOWNLOAD
      ? FileDownloadAction.DOWNLOAD
      : runtime.downloadAction === ContentBlockDownloadAction.SIGN_IN
        ? FileDownloadAction.SIGN_IN
        : runtime.downloadAction === ContentBlockDownloadAction.NONE
          ? FileDownloadAction.NONE
          : FileDownloadAction.UNSPECIFIED;

  return (
    <AuthorizedDownloadAction
      entityType={contentMedia.entityType}
      entityId={contentMedia.entityId}
      selector={{ blockId: block.id, referencePath: 'file' }}
      fileName={fileName}
      title={title}
      availability={availability}
      action={action}
      initialDownloadUrl={delivery?.download?.url}
      initialDownloadExpiresAt={initialDownloadExpiresAt}
      allowFileAuthorization={false}
      presentation={presentation}
      authorize={({ selector }) =>
        selector
          ? contentMedia.authorizeDownload(selector)
          : Promise.reject(new Error('Content Block selector is required.'))
      }
    />
  );
}
