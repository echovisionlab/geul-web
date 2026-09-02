'use client';

import { useCallback, type ReactNode } from 'react';
import katex from 'katex';
import { useTranslations } from 'next-intl';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { normalizeRichTextHref } from '@echovisionlab/geul-common/editor/link-normalization';
import {
  CodeBlockProps_Language,
  ContentBlockDownloadAction,
  ContentBlockDownloadAvailability,
  MissingAttachmentMediaKind,
  P5SketchProps_CapabilitiesItem,
  ShaderProps_StagesItem_ChannelsItem_Buffer,
  ShaderProps_StagesItem_ChannelsItem_Kind,
  ShaderProps_StagesItem_ChannelsItem_SamplerValue_Filter,
  ShaderProps_StagesItem_ChannelsItem_SamplerValue_Wrap,
  ThreeSceneProps_Language,
  type RichTextInline,
  type RichTextStyledText,
  type ShaderProps_StagesItem_ChannelsItem,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import {
  FileDownloadAction,
  FileDownloadAvailability,
  PublicMediaEntityType,
} from '@echovisionlab/geul-proto/public/file_pb.ts';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { assertNever, requireHeadingLevel } from '@/features/editor/contract/block-registry';
import { P5_CAPABILITIES, type P5Capability } from '@/features/editor/tiptap/p5/p5-capabilities';
import {
  SHADER_STAGE_DEFINITIONS,
  validateShaderPassGraph,
  type ShaderChannel,
  type ShaderProgramDocument,
  type ShaderSamplerOptions,
} from '@/features/editor/tiptap/shader/shader-program';
import type { ShaderAssetResolver } from '@/features/editor/tiptap/shader/shader-preview-runtime';
import { AudioMediaView } from '@/features/media/AudioMediaView';
import { ExternalVideoView } from '@/features/media/ExternalVideoView';
import { useContentBlockMediaItem } from '@/features/media/ContentBlockMediaRuntimeContext';
import { useContentMediaDelivery } from '@/features/media/ContentMediaDeliveryContext';
import { VideoMediaView } from '@/features/media/VideoMediaView';
import { AttachmentMediaView } from '@/features/media/ui/AttachmentMediaView';
import { ImageMediaView } from '@/features/media/ui/ImageMediaView';
import { MissingMediaView, type MissingMediaKind } from '@/features/media/ui/MissingMediaView';
import { AuthorizedDownloadAction } from '@/features/media-download/AuthorizedDownloadAction';
import { MapView } from '@/features/page/blocks/map/View';
import { resolveAudioViewModel } from '@/lib/media/audio-view-model';
import { formatMediaSize, mediaContainerStyleToReact, resolveMediaContainerStyle } from '@/lib/media/shared';
import { resolveGeneratedStandaloneExternalVideoLink } from '@/features/media/standalone-external-video';
import { resolveVideoViewModel } from '@/lib/media/video-view-model';
import { getFileTypeName } from '@/lib/utils/file-icon';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { getCodeBlockLanguageName, resolveCodeBlockLanguage } from '@/lib/editor/code-block-options';
import { CodeBlockSurface } from '@/features/editor/tiptap/code/CodeBlockSurface';
import { PublicExecutableBlockView } from './PublicExecutableBlockView';

interface GeneratedRichTextBlockViewProps {
  block: LocalizedRichTextBlock;
  requestedLocale?: string;
  downloadOwner?: {
    entityType: PublicMediaEntityType;
    entityId: string;
  };
  allowStandaloneExternalVideo?: boolean;
  isTopLevel?: boolean;
}

function alignment(value: number | undefined): 'left' | 'center' | 'right' {
  return value === 2 ? 'center' : value === 3 ? 'right' : 'left';
}

function containerStyle(previewWidth: number | undefined, textAlignment: number | undefined): React.CSSProperties {
  return (
    mediaContainerStyleToReact(resolveMediaContainerStyle(String(previewWidth ?? 100), alignment(textAlignment))) ?? {}
  );
}

function styledText(item: RichTextStyledText, key: string): ReactNode {
  let value: ReactNode = item.text;
  const styles = item.styles;
  if (styles?.bold) {
    value = <strong>{value}</strong>;
  }
  if (styles?.italic) {
    value = <em>{value}</em>;
  }
  if (styles?.underline) {
    value = <u>{value}</u>;
  }
  if (styles?.strike) {
    value = <s>{value}</s>;
  }
  if (styles?.code) {
    value = <code>{value}</code>;
  }
  if (styles?.textColor) {
    value = <span data-text-color={styles.textColor}>{value}</span>;
  }
  if (styles?.backgroundColor) {
    value = <span data-bg-color={styles.backgroundColor}>{value}</span>;
  }
  return <span key={key}>{value}</span>;
}

function inlineContent(content: readonly RichTextInline[]): ReactNode {
  return content.map((item, index) => {
    switch (item.value.case) {
      case 'text':
        return styledText(item.value.value, `text-${index}`);
      case 'hardBreak':
        return <br key={`break-${index}`} />;
      case 'link': {
        const href = normalizeRichTextHref(item.value.value.href);
        const children = item.value.value.content.map((text, textIndex) =>
          styledText(text, `link-${index}-${textIndex}`),
        );
        return href ? (
          <a key={`link-${index}`} href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ) : (
          <span key={`link-${index}`}>{children}</span>
        );
      }
      case 'mathInline': {
        const source = item.value.value.source;
        const html = katex.renderToString(source, { displayMode: false, throwOnError: false });
        return <span key={`math-${index}`} className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />;
      }
      case undefined:
        throw new Error('Generated rich-text inline node has no kind.');
      default:
        return assertNever(item.value, 'Unsupported generated rich-text inline kind');
    }
  });
}

function fileKind(mimeType: string): 'image' | 'audio' | 'video' | 'file' {
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

function missingKind(value: MissingAttachmentMediaKind): MissingMediaKind {
  switch (value) {
    case MissingAttachmentMediaKind.IMAGE:
      return 'image';
    case MissingAttachmentMediaKind.AUDIO:
      return 'audio';
    case MissingAttachmentMediaKind.VIDEO:
      return 'video';
    case MissingAttachmentMediaKind.FILE:
    case MissingAttachmentMediaKind.UNSPECIFIED:
      return 'file';
  }
}

function processingStatus(value: MediaProcessingStatus): string {
  switch (value) {
    case MediaProcessingStatus.PROCESSING:
      return 'processing';
    case MediaProcessingStatus.READY:
      return 'ready';
    case MediaProcessingStatus.FAILED:
      return 'failed';
    case MediaProcessingStatus.UNSPECIFIED:
      return '';
  }
}

function downloadAvailability(value: ContentBlockDownloadAvailability): FileDownloadAvailability {
  return value === ContentBlockDownloadAvailability.AVAILABLE
    ? FileDownloadAvailability.AVAILABLE
    : value === ContentBlockDownloadAvailability.UNAVAILABLE
      ? FileDownloadAvailability.UNAVAILABLE
      : FileDownloadAvailability.UNSPECIFIED;
}

function downloadAction(value: ContentBlockDownloadAction): FileDownloadAction {
  switch (value) {
    case ContentBlockDownloadAction.DOWNLOAD:
      return FileDownloadAction.DOWNLOAD;
    case ContentBlockDownloadAction.SIGN_IN:
      return FileDownloadAction.SIGN_IN;
    case ContentBlockDownloadAction.NONE:
      return FileDownloadAction.NONE;
    case ContentBlockDownloadAction.UNSPECIFIED:
      return FileDownloadAction.UNSPECIFIED;
  }
}

function GeneratedFileBlock({
  block,
  downloadOwner,
}: {
  block: Extract<LocalizedRichTextBlock, { kind: 'file' }>;
  downloadOwner?: GeneratedRichTextBlockViewProps['downloadOwner'];
}) {
  const tMissing = useTranslations('mediaCommon.missing');
  const tMedia = useTranslations('editorCommon.media');
  const contentMedia = useContentMediaDelivery();
  const runtime = useContentBlockMediaItem(block.id, 'file');
  const durableAttachment = block.base.props?.attachment?.state;
  if (!durableAttachment || durableAttachment.case === undefined) {
    throw new Error(`Generated File Block ${block.id} has no attachment.`);
  }
  const style = containerStyle(block.base.props?.previewWidth, block.base.props?.textAlignment);
  const caption = block.locale.props?.caption ?? '';
  if (durableAttachment.case === 'missingAttachment') {
    const kind = missingKind(durableAttachment.value.mediaKind);
    const messageKey = {
      file: 'fileDeleted',
      image: 'imageDeleted',
      video: 'videoDeleted',
      audio: 'audioDeleted',
    }[kind] as 'fileDeleted' | 'imageDeleted' | 'videoDeleted' | 'audioDeleted';
    return <MissingMediaView kind={kind} message={tMissing(messageKey)} caption={caption} style={style} />;
  }
  if (!runtime?.attachment || runtime.attachment.state.case !== 'activeFileId') {
    throw new Error(`Generated File Block ${block.id} has no active runtime attachment.`);
  }
  if (runtime.attachment.state.value !== durableAttachment.value) {
    throw new Error(`Generated File Block ${block.id} runtime attachment does not match durable state.`);
  }
  const delivery = runtime.delivery;
  if (!delivery) {
    throw new Error(`Generated File Block ${block.id} has no authorized delivery.`);
  }
  const name = block.base.props?.name || delivery.fileName || tMedia('attachmentEditor.untitledFile');
  const kind = fileKind(delivery.mimeType.toLowerCase());
  const action = (
    <AuthorizedDownloadAction
      entityType={downloadOwner?.entityType ?? PublicMediaEntityType.UNSPECIFIED}
      entityId={downloadOwner?.entityId ?? ''}
      selector={{ blockId: block.id, referencePath: 'file' }}
      fileName={name}
      title={name}
      availability={downloadAvailability(runtime.downloadAvailability)}
      action={downloadAction(runtime.downloadAction)}
      initialDownloadUrl={delivery.download?.url}
      initialDownloadExpiresAt={
        delivery.download?.expiresAt ? timestampDate(delivery.download.expiresAt).toISOString() : undefined
      }
      allowFileAuthorization={Boolean(downloadOwner)}
      authorize={
        contentMedia
          ? ({ selector }) =>
              selector
                ? contentMedia.authorizeDownload(selector)
                : Promise.reject(new Error('Content Block selector is required.'))
          : undefined
      }
      presentation="icon"
    />
  );
  if (kind === 'image') {
    const source = delivery.asset?.url || delivery.inline?.url;
    if (!source) {
      throw new Error(`Generated image Block ${block.id} has no delivery URL.`);
    }
    return (
      <ImageMediaView
        src={buildManagedImageUrl(source, MANAGED_IMAGE_PRESET.CONTENT_IMAGE) ?? source}
        alt={block.locale.props?.alt || name || caption}
        caption={caption}
        style={style}
        action={action}
      />
    );
  }
  const common = {
    fileId: delivery.fileId,
    url: delivery.inline?.url || delivery.asset?.url,
    originalUrl: delivery.inline?.url || delivery.asset?.url,
    hlsUrl: delivery.playback?.url,
    caption,
    name,
    size: String(delivery.fileSize),
    processingStatus: processingStatus(delivery.processingStatus),
    processingProgress: String(delivery.processingPercentage ?? 0),
    duration: String(delivery.durationSeconds ?? 0),
    previewWidth: String(block.base.props?.previewWidth ?? 100),
    textAlignment: alignment(block.base.props?.textAlignment),
  };
  if (kind === 'audio') {
    const model = resolveAudioViewModel({
      ...common,
      waveformUrl: delivery.waveform?.url,
      spectrogramUrl: delivery.spectrogram?.url,
    });
    return <AudioMediaView model={model} style={style} playerAction={action} />;
  }
  if (kind === 'video') {
    const model = resolveVideoViewModel({ ...common, thumbnailUrl: delivery.thumbnail?.url });
    return <VideoMediaView model={model} style={style} playerAction={action} />;
  }
  return (
    <AttachmentMediaView
      title={<span className="attachment-title">{name}</span>}
      meta={[getFileTypeName(delivery.mimeType), formatMediaSize(String(delivery.fileSize))]
        .filter(Boolean)
        .join(' · ')}
      caption={caption}
      style={style}
      action={action}
    />
  );
}

function codeLanguage(value: CodeBlockProps_Language | undefined): string {
  const name = value === undefined ? 'TEXT' : CodeBlockProps_Language[value];
  return name.toLowerCase().replace('vue_html', 'vue-html').replace('objective_c', 'objective-c');
}

function p5Capabilities(values: readonly P5SketchProps_CapabilitiesItem[]): P5Capability[] {
  return values.flatMap((value) => {
    const index = value - 1;
    return index >= 0 && index < P5_CAPABILITIES.length ? [P5_CAPABILITIES[index]!] : [];
  });
}

function activeAttachmentId(channel: ShaderProps_StagesItem_ChannelsItem): string | null {
  return channel.file?.state.case === 'activeFileId' ? channel.file.state.value : null;
}

function shaderSampler(channel: ShaderProps_StagesItem_ChannelsItem): ShaderSamplerOptions {
  return {
    filter:
      channel.sampler?.filter === ShaderProps_StagesItem_ChannelsItem_SamplerValue_Filter.LINEAR ? 'linear' : 'nearest',
    wrap: channel.sampler?.wrap === ShaderProps_StagesItem_ChannelsItem_SamplerValue_Wrap.REPEAT ? 'repeat' : 'clamp',
    vflip: channel.sampler?.vflip === true,
  };
}

function shaderChannel(channel: ShaderProps_StagesItem_ChannelsItem): ShaderChannel | null {
  const sampler = shaderSampler(channel);
  switch (channel.kind) {
    case ShaderProps_StagesItem_ChannelsItem_Kind.NONE:
      return { kind: 'none' };
    case ShaderProps_StagesItem_ChannelsItem_Kind.BUFFER: {
      const buffer =
        channel.buffer === ShaderProps_StagesItem_ChannelsItem_Buffer.A
          ? 'A'
          : channel.buffer === ShaderProps_StagesItem_ChannelsItem_Buffer.B
            ? 'B'
            : channel.buffer === ShaderProps_StagesItem_ChannelsItem_Buffer.C
              ? 'C'
              : channel.buffer === ShaderProps_StagesItem_ChannelsItem_Buffer.D
                ? 'D'
                : null;
      return buffer ? { kind: 'buffer', buffer } : null;
    }
    case ShaderProps_StagesItem_ChannelsItem_Kind.TEXTURE_FILE: {
      const fileId = activeAttachmentId(channel);
      return fileId ? { kind: 'textureFile', fileId, sampler } : null;
    }
    case ShaderProps_StagesItem_ChannelsItem_Kind.VIDEO_FILE: {
      const fileId = activeAttachmentId(channel);
      return fileId ? { kind: 'videoFile', fileId, sampler } : null;
    }
    case ShaderProps_StagesItem_ChannelsItem_Kind.CUBEMAP_FILES: {
      const fileIds = channel.faces.map((face) => (face.state.case === 'activeFileId' ? face.state.value : null));
      return fileIds.length === 6 && fileIds.every((id): id is string => id !== null)
        ? { kind: 'cubemapFiles', fileIds: fileIds as [string, string, string, string, string, string], sampler }
        : null;
    }
    case ShaderProps_StagesItem_ChannelsItem_Kind.CUBEMAP_PASS:
      return { kind: 'cubemapPass', sampler };
    case ShaderProps_StagesItem_ChannelsItem_Kind.UNSPECIFIED:
      return null;
  }
}

function shaderProgram(block: Extract<LocalizedRichTextBlock, { kind: 'shader' }>): ShaderProgramDocument | null {
  const stages = block.base.props?.stages ?? [];
  if (stages.length !== SHADER_STAGE_DEFINITIONS.length) {
    return null;
  }
  const sources = {} as ShaderProgramDocument['sources'];
  const channels: ShaderProgramDocument['channels'] = {};
  for (const [index, [stage]] of SHADER_STAGE_DEFINITIONS.entries()) {
    const value = stages[index];
    if (!value || value.kind !== index + 1) {
      return null;
    }
    sources[stage] = value.source;
    if (index >= 2) {
      const parsed = value.channels.map(shaderChannel);
      if (parsed.length !== 4 || parsed.some((channel) => channel === null)) {
        return null;
      }
      channels[stage as keyof typeof channels] = parsed as ShaderChannel[];
    }
  }
  const program = { sources, channels };
  return validateShaderPassGraph(program) ? null : program;
}

function GeneratedExecutableBlock({
  block,
}: {
  block: Extract<LocalizedRichTextBlock, { kind: 'p5-sketch' | 'three-scene' | 'shader' }>;
}) {
  const mediaDelivery = useContentMediaDelivery();
  const resolveAsset = useCallback<ShaderAssetResolver>(
    async (fileId, kind) => {
      if (!mediaDelivery) {
        throw new Error('Shader media delivery is unavailable.');
      }
      const url = await mediaDelivery.resolveAsset(fileId, kind);
      return { fileId, kind, url };
    },
    [mediaDelivery],
  );
  const common = {
    blockId: block.id,
    title: block.locale.props?.title ?? '',
    previewHeight: block.base.props?.previewHeight ?? 360,
    style: containerStyle(block.base.props?.previewWidth, block.base.props?.textAlignment),
  };
  if (block.kind === 'shader') {
    const program = shaderProgram(block);
    return program ? (
      <PublicExecutableBlockView
        {...common}
        type="shader"
        language="glsl"
        program={program}
        resolveAsset={resolveAsset}
      />
    ) : (
      <div data-invalid-executable-block="shader" />
    );
  }
  if (block.kind === 'three-scene') {
    return (
      <PublicExecutableBlockView
        {...common}
        type="threeScene"
        source={block.base.props?.source ?? ''}
        language={block.base.props?.language === ThreeSceneProps_Language.JAVASCRIPT ? 'javascript' : 'typescript'}
      />
    );
  }
  return (
    <PublicExecutableBlockView
      {...common}
      type="p5Sketch"
      source={block.base.props?.source ?? ''}
      language="javascript"
      capabilities={p5Capabilities(block.base.props?.capabilities ?? [])}
    />
  );
}

function GeneratedParagraphBlock({
  block,
  allowStandaloneExternalVideo,
  isTopLevel,
}: {
  block: Extract<LocalizedRichTextBlock, { kind: 'paragraph' }>;
  allowStandaloneExternalVideo: boolean;
  isTopLevel: boolean;
}) {
  const labels = useTranslations('editorCommon.editor.runtimeLabels.externalVideo');
  const externalVideo =
    allowStandaloneExternalVideo && isTopLevel
      ? resolveGeneratedStandaloneExternalVideoLink(
          {
            content: block.locale.content,
            props: block.base.props,
            hasChildren: block.children.length > 0,
          },
          {
            youtubeTitle: labels('youtubeTitle'),
            vimeoTitle: labels('vimeoTitle'),
          },
        )
      : null;
  if (externalVideo) {
    return (
      <ExternalVideoView
        url={externalVideo.url}
        title={externalVideo.title}
        aspectRatio={externalVideo.aspectRatio}
        style={mediaContainerStyleToReact(
          resolveMediaContainerStyle(externalVideo.previewWidth, externalVideo.textAlignment),
        )}
      />
    );
  }

  return <p style={{ textAlign: alignment(block.base.props?.textAlignment) }}>{inlineContent(block.locale.content)}</p>;
}

export function GeneratedRichTextBlockView({
  block,
  requestedLocale,
  downloadOwner,
  allowStandaloneExternalVideo = false,
  isTopLevel = true,
}: GeneratedRichTextBlockViewProps) {
  switch (block.kind) {
    case 'paragraph':
      return (
        <GeneratedParagraphBlock
          block={block}
          allowStandaloneExternalVideo={allowStandaloneExternalVideo}
          isTopLevel={isTopLevel}
        />
      );
    case 'heading': {
      const level = requireHeadingLevel(block.base.props?.level ?? 1);
      const Heading = `h${level}` as 'h1' | 'h2' | 'h3';
      return (
        <Heading id={block.id} style={{ textAlign: alignment(block.base.props?.textAlignment) }}>
          {inlineContent(block.locale.content)}
        </Heading>
      );
    }
    case 'bullet-list-item':
      return (
        <ul>
          <li>
            {inlineContent(block.locale.content)}
            {block.children.map((child) => (
              <GeneratedRichTextBlockView
                key={child.id}
                block={child}
                requestedLocale={requestedLocale}
                downloadOwner={downloadOwner}
                allowStandaloneExternalVideo={allowStandaloneExternalVideo}
                isTopLevel={false}
              />
            ))}
          </li>
        </ul>
      );
    case 'numbered-list-item':
      return (
        <ol start={block.base.props?.start}>
          <li>
            {inlineContent(block.locale.content)}
            {block.children.map((child) => (
              <GeneratedRichTextBlockView
                key={child.id}
                block={child}
                requestedLocale={requestedLocale}
                downloadOwner={downloadOwner}
                allowStandaloneExternalVideo={allowStandaloneExternalVideo}
                isTopLevel={false}
              />
            ))}
          </li>
        </ol>
      );
    case 'check-list-item':
      return (
        <div className="check-list-item">
          <input type="checkbox" checked={block.base.props?.checked ?? false} readOnly />
          <span>{inlineContent(block.locale.content)}</span>
        </div>
      );
    case 'quote':
      return <blockquote>{inlineContent(block.locale.content)}</blockquote>;
    case 'callout':
      return (
        <aside
          data-callout=""
          data-bg-color={block.base.props?.backgroundColor ?? 'gray'}
          data-text-color={block.base.props?.textColor ?? 'default'}
        >
          <span data-callout-icon="" aria-hidden="true">
            {block.base.props?.icon ?? '💡'}
          </span>
          <div data-callout-content="">
            <div data-callout-copy="">{inlineContent(block.locale.content)}</div>
            {block.children.map((child) => (
              <GeneratedRichTextBlockView
                key={child.id}
                block={child}
                requestedLocale={requestedLocale}
                downloadOwner={downloadOwner}
                allowStandaloneExternalVideo={allowStandaloneExternalVideo}
                isTopLevel={false}
              />
            ))}
          </div>
        </aside>
      );
    case 'code-block': {
      const language = codeLanguage(block.base.props?.language);
      const resolved = resolveCodeBlockLanguage(language);
      return (
        <CodeBlockSurface
          title={block.locale.props?.title ?? ''}
          fallbackTitle={getCodeBlockLanguageName(language)}
          titleLabel="Title"
          languageName={getCodeBlockLanguageName(language)}
          source={block.locale.content}
          sourceLabel="Source"
          copyLabel="Copy"
          monacoLanguage={resolved.monacoLanguage}
          modelPath={`public/code/${encodeURIComponent(block.id)}.${resolved.fileExtension}`}
        />
      );
    }
    case 'divider':
      return <hr />;
    case 'table': {
      const base = block.base.content;
      const locale = block.locale.content;
      if (!base || !locale || base.rows.length !== locale.rows.length) {
        throw new Error(`Generated table Block ${block.id} shape mismatch.`);
      }
      return (
        <table style={containerStyle(block.base.props?.previewWidth, block.base.props?.textAlignment)}>
          {base.columnWidths.length ? (
            <colgroup>
              {base.columnWidths.map((width, index) => (
                <col key={index} style={{ width: `${width}%` }} />
              ))}
            </colgroup>
          ) : null}
          <tbody>
            {base.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.cells.map((cell, cellIndex) => {
                  const Cell = cell.header ? 'th' : 'td';
                  const localized = locale.rows[rowIndex]?.cells[cellIndex];
                  if (!localized) {
                    throw new Error(`Generated table Block ${block.id} cell shape mismatch.`);
                  }
                  return (
                    <Cell
                      key={cellIndex}
                      colSpan={cell.props?.colspan}
                      rowSpan={cell.props?.rowspan}
                      style={{ textAlign: alignment(cell.props?.textAlignment) }}
                    >
                      {inlineContent(localized.content)}
                    </Cell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case 'p5-sketch':
    case 'three-scene':
    case 'shader':
      return <GeneratedExecutableBlock block={block} />;
    case 'math': {
      const source = block.base.props?.latex ?? '';
      const html = katex.renderToString(source, { displayMode: true, throwOnError: false });
      return <div className="math-block" data-latex={source} dangerouslySetInnerHTML={{ __html: html }} />;
    }
    case 'map':
      return (
        <MapView
          requestedLocale={requestedLocale}
          props={{
            mapPlaceIds: block.base.props?.mapPlaceIds.join(',') ?? '',
            aspectRatio:
              block.base.props?.aspectRatio === 2 ? '4:3' : block.base.props?.aspectRatio === 3 ? '1:1' : '16:9',
            previewWidth: String(block.base.props?.previewWidth ?? 100),
            textAlignment: alignment(block.base.props?.textAlignment),
            zoom: String(block.base.props?.zoom ?? 15),
            minZoom: String(block.base.props?.minZoom ?? 1),
            maxZoom: String(block.base.props?.maxZoom ?? 20),
            draggable: String(block.base.props?.draggable ?? true),
            zoomable: String(block.base.props?.zoomable ?? true),
            rotatable: String(block.base.props?.rotatable ?? false),
            tiltable: String(block.base.props?.tiltable ?? false),
            pinClickable: String(block.base.props?.pinClickable ?? true),
            centerLat: String(block.base.props?.centerLat ?? ''),
            centerLng: String(block.base.props?.centerLng ?? ''),
            pitch: String(block.base.props?.pitch ?? 0),
            bearing: String(block.base.props?.bearing ?? 0),
            show3DBuildings: String(block.base.props?.show3dBuildings ?? false),
            autoRotate: String(block.base.props?.autoRotate ?? false),
            autoRotateSpeed: String(block.base.props?.autoRotateSpeed ?? 1),
            showDirections: String(block.base.props?.showDirections ?? true),
            variant: 'default',
            themeId: block.base.props?.themeId ?? '',
            preferredScheme:
              block.base.props?.preferredScheme === 2
                ? 'light'
                : block.base.props?.preferredScheme === 3
                  ? 'dark'
                  : 'auto',
            areaLabelsMode:
              block.base.props?.areaLabelsMode === 2
                ? 'show'
                : block.base.props?.areaLabelsMode === 3
                  ? 'hide'
                  : 'inherit',
            poiLabelsMode:
              block.base.props?.poiLabelsMode === 2
                ? 'show'
                : block.base.props?.poiLabelsMode === 3
                  ? 'hide'
                  : 'inherit',
            caption: block.locale.props?.caption ?? '',
          }}
        />
      );
    case 'file':
      return <GeneratedFileBlock block={block} downloadOwner={downloadOwner} />;
    default:
      return assertNever(block, 'Unsupported generated public rich-text Block kind');
  }
}
