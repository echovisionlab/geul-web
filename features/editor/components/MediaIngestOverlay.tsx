'use client';

import { Box, Overlay, Progress, Text } from '@mantine/core';

interface MediaIngestOverlayProps {
  title: string;
  percentage?: number | null;
  detail?: string | null;
}

export function MediaIngestOverlay({ title, percentage, detail }: MediaIngestOverlayProps) {
  const normalizedPercentage =
    typeof percentage === 'number' && Number.isFinite(percentage)
      ? Math.max(0, Math.min(100, Math.round(percentage)))
      : null;

  return (
    <Overlay backgroundOpacity={0.6} blur={2} zIndex={100}>
      <Box pos="absolute" top="50%" left="50%" style={{ transform: 'translate(-50%, -50%)' }} w="80%" maw={400}>
        <Text size="sm" c="white" ta="center">
          {title}
        </Text>
        <Progress size="lg" animated mt="xs" value={normalizedPercentage ?? 0} />
        {detail ? (
          <Text size="xs" mt="xs" c="white" ta="center">
            {detail}
          </Text>
        ) : null}
        {normalizedPercentage !== null ? (
          <Text size="xs" mt="xs" c="white" ta="center">
            {normalizedPercentage}%
          </Text>
        ) : null}
      </Box>
    </Overlay>
  );
}
