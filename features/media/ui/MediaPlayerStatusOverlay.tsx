import { ProcessingOverlay } from '@/components/core/LoadingSurface/ProcessingOverlay';

export interface MediaPlayerStatusOverlayProps {
  message: string;
  kind: 'loading' | 'processing';
}

export function MediaPlayerStatusOverlay({ message, kind }: MediaPlayerStatusOverlayProps) {
  return (
    <ProcessingOverlay
      data-media-player-status-overlay={kind}
      role="status"
      aria-live="polite"
      progress={{ value: null, title: message, 'aria-label': message }}
    />
  );
}
