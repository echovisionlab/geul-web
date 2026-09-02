import { Group, SimpleGrid, Skeleton, Stack } from '@mantine/core';
import { ContentCard } from '@/components/core/Section';

interface AuthorListSkeletonProps {
  columns?: number;
  limit?: number;
}

export function AuthorListSkeleton({ columns = 3, limit = 6 }: AuthorListSkeletonProps) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: columns }} spacing="lg" className="author-list-block">
      {Array.from({ length: limit }).map((_, i) => (
        <ContentCard key={i} padding="lg" radius="md" withBorder>
          <Group>
            <Skeleton circle height={60} width={60} />
            <Stack gap="xs" style={{ flex: 1 }}>
              <Skeleton height={16} width="60%" />
              <Skeleton height={12} width="80%" />
            </Stack>
          </Group>
        </ContentCard>
      ))}
    </SimpleGrid>
  );
}
