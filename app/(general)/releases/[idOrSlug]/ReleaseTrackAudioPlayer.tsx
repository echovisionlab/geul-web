'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { resolveAudioPlaybackHydration } from '@echovisionlab/geul-common/media/hydration';
import type { FileDownloadAction, FileDownloadAvailability } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { PUBLIC_MEDIA_ENTITY_TYPE } from '@/features/media-download/download-wire-values';

import { AudioPlayer } from '@/features/media/AudioPlayer';
import {
  AuthorizedDownloadAction,
  isDownloadActionOffered,
  type AuthorizedDownloadActionProps,
} from '@/features/media-download/AuthorizedDownloadAction';
import { authorizeReleaseTrackDownload } from '@/lib/queries/release-download-browser';

interface ReleaseTrackAudioPlayerProps {
  releaseId: string;
  trackId: string;
  title: string;
  fileId: string | null;
  fileName: string | null;
  durationSeconds: number;
  hlsUrl: string | null;
  waveform?: number[] | number[][];
  spectrogramUrl?: string | null;
  downloadAvailability: FileDownloadAvailability;
  downloadAction: FileDownloadAction;
  downloadUrl?: string | null;
  downloadExpiresAt?: string | null;
  requestedLocale: string;
  shareToken?: string;
  sharePassword?: string;
  authorizeDownload?: AuthorizedDownloadActionProps['authorize'];
  navigateDownload?: AuthorizedDownloadActionProps['navigate'];
}

export function ReleaseTrackAudioPlayer({
  releaseId,
  trackId,
  title,
  fileId,
  fileName,
  durationSeconds,
  hlsUrl,
  waveform,
  downloadAvailability,
  downloadAction,
  downloadUrl,
  downloadExpiresAt,
  requestedLocale,
  shareToken,
  sharePassword,
  authorizeDownload,
  navigateDownload,
}: ReleaseTrackAudioPlayerProps) {
  const access = resolveAudioPlaybackHydration({
    hlsUrl: hlsUrl ?? undefined,
  });
  if (!access.playbackUrl && !fileId) {
    return null;
  }

  const downloadControl =
    fileId && isDownloadActionOffered(downloadAvailability, downloadAction) ? (
      <AuthorizedDownloadAction
        entityType={PUBLIC_MEDIA_ENTITY_TYPE.RELEASE}
        entityId={releaseId}
        trackId={trackId}
        fileName={fileName || title}
        title={title}
        availability={downloadAvailability}
        action={downloadAction}
        authorize={
          authorizeDownload ??
          ((input) =>
            authorizeReleaseTrackDownload({
              ...input,
              idOrSlug: releaseId,
              trackId,
              requestedLocale,
              shareToken,
              sharePassword,
            }))
        }
        navigate={navigateDownload}
        initialDownloadUrl={downloadUrl ?? undefined}
        initialDownloadExpiresAt={downloadExpiresAt ?? undefined}
        allowFileAuthorization={false}
        presentation="icon"
      />
    ) : null;

  return (
    <DsLayoutStack gap="xs">
      {access.playbackUrl ? (
        <AudioPlayer
          src={access.playbackUrl}
          hlsSrc={access.hlsUrl}
          name={title}
          isReady
          duration={durationSeconds}
          waveform={waveform}
          action={downloadControl}
        />
      ) : null}
      {!access.playbackUrl ? downloadControl : null}
    </DsLayoutStack>
  );
}
