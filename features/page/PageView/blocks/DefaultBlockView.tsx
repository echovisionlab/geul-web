'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { normalizeRichTextHref } from '@echovisionlab/geul-common/editor/link-normalization';
import { hasAttachedFileId } from '@echovisionlab/geul-common/media/block-schemas';
import {
  ContentBlockDownloadAction,
  ContentBlockDownloadAvailability,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { FileDownloadAction, FileDownloadAvailability } from '@echovisionlab/geul-proto/public/file_pb.ts';
import {
  richTextBlockKindByProtoCase,
  type RichTextBlockKind,
} from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { AudioMediaView } from '@/features/media/AudioMediaView';
import { VideoMediaView } from '@/features/media/VideoMediaView';
import { AttachmentMediaView } from '@/features/media/ui/AttachmentMediaView';
import { ImageMediaView } from '@/features/media/ui/ImageMediaView';
import { MissingMediaView, type MissingMediaKind } from '@/features/media/ui/MissingMediaView';
import { AuthorizedDownloadAction } from '@/features/media-download/AuthorizedDownloadAction';
import { useContentMediaDelivery } from '@/features/media/ContentMediaDeliveryContext';
import { useOptionalContentBlockMediaRuntime } from '@/features/media/ContentBlockMediaRuntimeContext';
import { resolveAudioViewModelFromBlock } from '@/lib/media/audio-view-model';
import { formatMediaSize, getBlockPropString } from '@/lib/media/shared';
import { resolveVideoViewModelFromBlock } from '@/lib/media/video-view-model';
import type { Block, InlineContent } from '@/lib/types/page-content';
import { getFileTypeName } from '@/lib/utils/file-icon';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { isBlockId } from '@/lib/editor/block-id';
import { getContainerStyle } from './DefaultBlockView.utils';

const DefaultInlineMathView = dynamic<{ latex: string }>(() =>
  import('./DefaultInlineMathView').then((module) => module.DefaultInlineMathView),
);
const DefaultMathBlockView = dynamic<{ block: Block }>(() =>
  import('./DefaultMathBlockView').then((module) => module.DefaultMathBlockView),
);
const DefaultMapBlockView = dynamic<{ block: Block; requestedLocale?: string }>(() =>
  import('./DefaultMapBlockView').then((module) => module.DefaultMapBlockView),
);
const DefaultCodeBlockView = dynamic<{ block: Block }>(() =>
  import('./DefaultCodeBlockView').then((module) => module.DefaultCodeBlockView),
);
const DefaultMermaidBlockView = dynamic<{ source: string; title: string }>(() =>
  import('./DefaultMermaidBlockView').then((module) => module.DefaultMermaidBlockView),
);
const DefaultExecutableBlockView = dynamic<{ block: Block; source: string }>(() =>
  import('./DefaultExecutableBlockView').then((module) => module.DefaultExecutableBlockView),
);

export { resolveShaderMediaAsset } from './DefaultBlockView.utils';

const richTextBlockKinds = new Set<string>(Object.values(richTextBlockKindByProtoCase));

interface DefaultBlockViewProps {
  block: Block;
  requestedLocale?: string;
}

function hasOwn<TObject extends object>(value: TObject, key: PropertyKey): key is keyof TObject {
  return Object.hasOwn(value, key);
}

function requireRichTextBlockKind(value: string): RichTextBlockKind {
  if (!richTextBlockKinds.has(value)) {
    throw new Error(`Unsupported rich-text Block kind: ${value}`);
  }
  return value as RichTextBlockKind;
}

function assertNever(value: never, message: string): never {
  throw new Error(`${message}: ${String(value)}`);
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
      return <DefaultMapBlockView block={block} requestedLocale={requestedLocale} />;
    case 'math':
      return <DefaultMathBlockView block={block} />;
    case 'code-block':
      return <DefaultCodeBlockView block={block} />;
    case 'mermaid':
      return (
        <DefaultMermaidBlockView source={executableSource(block)} title={getBlockPropString(block.props, 'title')} />
      );
    case 'p5-sketch':
    case 'three-scene':
    case 'shader':
      return <DefaultExecutableBlockView block={block} source={executableSource(block)} />;
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
      return <DefaultInlineMathView key={index} latex={item.props?.latex as string} />;
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

function executableSource(block: Block): string {
  const source = block.content?.map((node) => (node.type === 'text' ? (node.text ?? '') : '')).join('') ?? '';
  if (source) {
    return source;
  }
  return block.type === 'p5Sketch' || block.type === 'threeScene' || block.type === 'mermaid'
    ? getBlockPropString(block.props, 'source')
    : '';
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
