'use client';

import { resolveAudioPlaybackHydration } from '@echovisionlab/geul-common/media/hydration';
import {
  FileDownloadAction,
  FileDownloadAvailability,
  PublicMediaEntityType,
} from '@echovisionlab/geul-proto/public/file_pb.ts';
import { Stack } from '@mantine/core';
import { AudioPlayer } from '@/features/media/AudioPlayer';
import {
  AuthorizedDownloadAction,
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

  const downloadControl = fileId ? (
    <AuthorizedDownloadAction
      entityType={PublicMediaEntityType.RELEASE}
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
    <Stack gap="xs">
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
    </Stack>
  );
}
