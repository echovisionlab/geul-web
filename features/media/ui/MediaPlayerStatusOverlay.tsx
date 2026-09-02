import { Loader, Stack, Text } from '@mantine/core';

export interface MediaPlayerStatusOverlayProps {
  message: string;
  kind: 'loading' | 'processing';
}

export function MediaPlayerStatusOverlay({ message, kind }: MediaPlayerStatusOverlayProps) {
  return (
    <div
      className="media-player__status-overlay"
      data-media-player-status-overlay={kind}
      role="status"
      aria-live="polite"
    >
      <Stack gap={6} align="center" data-media-player-status-content>
        <Loader size="sm" color="var(--media-player-accent)" />
        <Text size="xs" fw={500} ta="center">
          {message}
        </Text>
      </Stack>
    </div>
  );
}
