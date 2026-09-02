import type { ReactNode } from 'react';
import { Box, Divider, Grid, GridCol, Stack, Table, Text } from '@mantine/core';
import { DateTime } from '@/features/date-time/DateTime';
import { PageHeader } from '@/components/core/PageHeader';
import { TextButton } from '@/components/core/TextButton';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';

export interface SeriesPublicPostItem {
  id: string;
  title: string;
  slug?: string | null;
  publishedAt?: string | null;
  authors: Array<{ id: string; name?: string | null }>;
}

interface SeriesPublicPostsViewProps {
  posts: SeriesPublicPostItem[];
  labels: {
    title: string;
    authors: string;
    published: string;
    empty: string;
    untitled: string;
    unknown: string;
  };
}

export function SeriesPublicPostsView({ posts, labels }: SeriesPublicPostsViewProps) {
  if (posts.length === 0) {
    return (
      <Text size="sm" c="dimmed" py="md">
        {labels.empty}
      </Text>
    );
  }

  return (
    <Table.ScrollContainer minWidth={640}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{labels.title}</Table.Th>
            <Table.Th w={220}>{labels.authors}</Table.Th>
            <Table.Th w={150}>{labels.published}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {posts.map((post) => (
            <Table.Tr key={post.id}>
              <Table.Td>
                <TextButton href={`/posts/${post.slug || post.id}`} size="sm" weight="medium" appearance="default">
                  {post.title || labels.untitled}
                </TextButton>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {post.authors.length > 0
                    ? post.authors.map((author) => author.name || labels.unknown).join(', ')
                    : '-'}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  <DateTime value={post.publishedAt} />
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

interface SeriesPublicViewProps {
  title: string;
  description?: string | null;
  featuredImageUrl?: string | null;
  controls?: ReactNode;
  postsLabel: string;
  children: ReactNode;
}

export function SeriesPublicView({
  title,
  description,
  featuredImageUrl,
  controls,
  postsLabel,
  children,
}: SeriesPublicViewProps) {
  const details = (
    <PageHeader
      title={title}
      description={description ? <span style={{ whiteSpace: 'pre-wrap' }}>{description}</span> : undefined}
      actions={controls}
    />
  );

  return (
    <Stack gap="xl">
      {featuredImageUrl ? (
        <Grid gap="xl" align="start">
          <GridCol span={{ base: 12, md: 6 }}>
            <Box>
              <img
                src={buildManagedImageUrl(featuredImageUrl, MANAGED_IMAGE_PRESET.HEADER_IMAGE) ?? featuredImageUrl}
                alt={title}
                style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 640, objectFit: 'contain' }}
              />
            </Box>
          </GridCol>
          <GridCol span={{ base: 12, md: 6 }}>{details}</GridCol>
        </Grid>
      ) : (
        details
      )}

      <Divider />
      <Stack gap="sm">
        <PageHeader title={postsLabel} level={2} />
        {children}
      </Stack>
    </Stack>
  );
}
