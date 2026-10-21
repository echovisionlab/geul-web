import type { ComponentType } from 'react';
import type { ExternalVideoViewProps } from '@/features/media/ExternalVideoView';
import { LocalizedExternalVideoView } from '@/features/media/LocalizedExternalVideoView';
import type { BlockViewProps } from '../types';
import { parseExternalVideoProps } from './schema';

interface PageExternalVideoViewProps extends BlockViewProps {
  videoView?: ComponentType<ExternalVideoViewProps>;
}

export function PageExternalVideoView({
  props,
  videoView: VideoView = LocalizedExternalVideoView,
}: PageExternalVideoViewProps) {
  const parsed = parseExternalVideoProps(props);
  const title = parsed.caption.trim() || 'External video';

  return <VideoView url={parsed.url} title={title} caption={parsed.caption} aspectRatio={parsed.aspectRatio} />;
}
