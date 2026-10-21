'use client';

import { ExternalVideoView, type ExternalVideoViewProps } from './ExternalVideoView';
import { useExternalVideoPlaybackLabels } from './useExternalVideoPlaybackLabels';

/** The external video player with localized play and consent copy, for server-rendered pages. */
export function LocalizedExternalVideoView(props: Omit<ExternalVideoViewProps, 'playbackLabels'>) {
  return <ExternalVideoView {...props} playbackLabels={useExternalVideoPlaybackLabels()} />;
}
