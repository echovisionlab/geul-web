import type { ComponentType } from 'react';
import { ExternalVideoView, type ExternalVideoViewProps } from '@/features/media/ExternalVideoView';
import type { BlockViewProps } from '../types';
import { parseExternalVideoProps } from './schema';

interface PageExternalVideoViewProps extends BlockViewProps {
  videoView?: ComponentType<ExternalVideoViewProps>;
}

export function PageExternalVideoView({ props, videoView: VideoView = ExternalVideoView }: PageExternalVideoViewProps) {
  const parsed = parseExternalVideoProps(props);
  const title = parsed.caption.trim() || 'External video';

  return <VideoView url={parsed.url} title={title} caption={parsed.caption} aspectRatio={parsed.aspectRatio} />;
}
