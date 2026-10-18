import { SupportingText, Text as DsText } from '@/components/core/Typography';

import { LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import type { ReactNode } from 'react';
import { Table } from '@/components/core/Display';
import {
  EntityDetailImage,
  EntityDetailLayout,
  EntityDetailSection,
} from '@/features/document-layout/ui/EntityDetailLayout';
import { DateTime } from '@/features/date-time/DateTime';
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
  /** Names the table and its scroll region; the enclosing section already carries the "Posts" title. */
  tableLabel?: string;
  labels: {
    title: string;
    authors: string;
    published: string;
    empty: string;
    untitled: string;
    unknown: string;
  };
}

export function SeriesPublicPostsView({ posts, labels, tableLabel = labels.title }: SeriesPublicPostsViewProps) {
  if (posts.length === 0) {
    return (
      <DsLayoutInset block="md">
        <SupportingText tone="secondary">{labels.empty}</SupportingText>
      </DsLayoutInset>
    );
  }

  return (
    <Table.ScrollContainer minWidth={640} role="region" aria-label={tableLabel} tabIndex={0}>
      <Table striped highlightOnHover aria-label={tableLabel}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">{labels.title}</Table.Th>
            <Table.Th scope="col" width={220}>
              {labels.authors}
            </Table.Th>
            <Table.Th scope="col" width={150}>
              {labels.published}
            </Table.Th>
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
                <DsText size="sm" tone="secondary">
                  {post.authors.length > 0
                    ? post.authors.map((author) => author.name || labels.unknown).join(', ')
                    : '-'}
                </DsText>
              </Table.Td>
              <Table.Td>
                <DsText size="sm" tone="secondary">
                  <DateTime value={post.publishedAt} />
                </DsText>
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
  featuredImageUrl?: string | null;
  controls?: ReactNode;
  postsLabel: string;
  children: ReactNode;
}

export function SeriesPublicView({ title, featuredImageUrl, controls, postsLabel, children }: SeriesPublicViewProps) {
  return (
    <EntityDetailLayout
      media={
        featuredImageUrl ? (
          <EntityDetailImage
            src={buildManagedImageUrl(featuredImageUrl, MANAGED_IMAGE_PRESET.HEADER_IMAGE) ?? featuredImageUrl}
            alt={title}
          />
        ) : undefined
      }
      title={title}
      actions={controls}
    >
      <EntityDetailSection title={postsLabel}>{children}</EntityDetailSection>
    </EntityDetailLayout>
  );
}
