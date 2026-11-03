import type { ReactNode, Ref } from 'react';
import { MediaVideoFrame } from '@/components/core/MediaControls';

export interface VideoPlayerViewProps {
  name: string;
  mountRef?: Ref<HTMLDivElement>;
  preparing: boolean;
  processing: boolean;
  loadingSurface: ReactNode;
  processingSurface: ReactNode;
  children?: ReactNode;
}

export function VideoPlayerView({
  name,
  mountRef,
  preparing,
  processing,
  loadingSurface,
  processingSurface,
  children,
}: VideoPlayerViewProps) {
  return (
    <MediaVideoFrame preparing={preparing} processing={processing} role="group" aria-label={name}>
      <div ref={mountRef} className="video-player__mount" data-video-player-mount aria-busy={preparing} />
      {preparing && !processing ? loadingSurface : null}
      {processing ? <div data-processing-overlay>{processingSurface}</div> : null}
      {children}
    </MediaVideoFrame>
  );
}
