import { create } from '@bufbuild/protobuf';
import {
  AssetDisposition,
  MediaDeliveryPurpose,
  MediaDeliverySchema,
  MediaProcessingStatus,
  type MediaDelivery,
} from '@echovisionlab/geul-proto/common/media_pb.ts';

interface MediaDeliveryFixtureInput {
  fileId?: string;
  extension?: string;
  mimeType?: string;
  fileSize?: bigint;
  fileName?: string;
  durationSeconds?: number;
  assetUrl?: string;
  inlineUrl?: string;
  downloadUrl?: string;
  playbackUrl?: string;
  thumbnailUrl?: string;
  spectrogramUrl?: string;
  waveformUrl?: string;
  processingStatus?: MediaProcessingStatus;
  processingPercentage?: number;
}

export function mediaDeliveryFixture(input: MediaDeliveryFixtureInput): MediaDelivery {
  const fileId = input.fileId ?? 'file-fixture';
  const extension = input.extension ?? '';
  const mimeType = input.mimeType ?? '';
  const expiringRef = (url: string, purpose: MediaDeliveryPurpose) => ({
    fileId,
    url,
    purpose,
    extension,
    mimeType,
  });
  const assetRef = (url: string) => ({
    assetId: `asset-${fileId}`,
    url,
    extension,
    mimeType,
    disposition: AssetDisposition.INLINE,
  });

  return create(MediaDeliverySchema, {
    fileId,
    extension,
    mimeType,
    fileSize: input.fileSize ?? BigInt(0),
    fileName: input.fileName,
    durationSeconds: input.durationSeconds,
    asset: input.assetUrl ? assetRef(input.assetUrl) : undefined,
    inline: input.inlineUrl ? expiringRef(input.inlineUrl, MediaDeliveryPurpose.INLINE) : undefined,
    download: input.downloadUrl ? expiringRef(input.downloadUrl, MediaDeliveryPurpose.DOWNLOAD) : undefined,
    playback: input.playbackUrl ? { fileId, generationId: 'generation-fixture', url: input.playbackUrl } : undefined,
    thumbnail: input.thumbnailUrl ? assetRef(input.thumbnailUrl) : undefined,
    spectrogram: input.spectrogramUrl ? assetRef(input.spectrogramUrl) : undefined,
    waveform: input.waveformUrl ? assetRef(input.waveformUrl) : undefined,
    processingStatus: input.processingStatus ?? MediaProcessingStatus.UNSPECIFIED,
    processingPercentage: input.processingPercentage,
  });
}
