'use client';

import { timestampDate } from '@bufbuild/protobuf/wkt';
import { useTranslations } from 'next-intl';
import {
  ContentBlockDownloadAction,
  ContentBlockDownloadAvailability,
  MissingAttachmentMediaKind,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import {
  FileDownloadAction,
  FileDownloadAvailability,
  PublicMediaEntityType,
} from '@echovisionlab/geul-proto/public/file_pb.ts';
import type { GeneratedRichTextBlockViewProps } from './GeneratedRichTextBlockView.types';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { AudioMediaView } from '@/features/media/AudioMediaView';
import { useContentBlockMediaItem } from '@/features/media/ContentBlockMediaRuntimeContext';
import { useContentMediaDelivery } from '@/features/media/ContentMediaDeliveryContext';
import { VideoMediaView } from '@/features/media/VideoMediaView';
import { AttachmentMediaView } from '@/features/media/ui/AttachmentMediaView';
import { ImageMediaView } from '@/features/media/ui/ImageMediaView';
import { MissingMediaView, type MissingMediaKind } from '@/features/media/ui/MissingMediaView';
import { AuthorizedDownloadAction } from '@/features/media-download/AuthorizedDownloadAction';
import { resolveAudioViewModel } from '@/lib/media/audio-view-model';
import { formatMediaSize } from '@/lib/media/shared';
import { resolveVideoViewModel } from '@/lib/media/video-view-model';
import { getFileTypeName } from '@/lib/utils/file-icon';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { alignment, containerStyle } from './GeneratedRichTextViewUtils';

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

export function GeneratedFileBlockView({
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
