import { Box, Skeleton, Stack } from '@mantine/core';
import { ContentCard } from '@/components/core/Section';

export function PostMapSkeleton() {
  return (
    <Stack gap="md">
      <Box
        style={{
          aspectRatio: '16 / 9',
          borderRadius: 'var(--mantine-radius-md)',
          overflow: 'hidden',
        }}
      >
        <Skeleton height="100%" />
      </Box>

      <ContentCard radius={0} withBorder padding="lg">
        <Stack gap="sm">
          <Skeleton height={18} width="35%" />
          <Skeleton height={14} width="55%" />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 'var(--mantine-spacing-md)',
              marginTop: 'var(--mantine-spacing-sm)',
            }}
          >
            <Skeleton height={140} />
            <Skeleton height={140} />
          </div>
        </Stack>
      </ContentCard>
    </Stack>
  );
}
