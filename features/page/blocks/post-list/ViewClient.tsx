'use client';

import { Group, Text } from '@mantine/core';
import { DateTime } from '@/features/date-time/DateTime';
import { ListViewShell } from '../ListViewShell';
import { PostAuthorLinks } from './PostAuthorLinks';
import { PostMetaLinks } from './PostMetaLinks';
import type { PostListProps } from './schema';
import classes from './PostListCard.module.css';

interface PostListPost {
  id: string;
  slug: string | null;
  title: string | null;
  featured_image_url: string | null;
  published_at: string | null;
  authors: { id: string; name: string | null; image: string | null }[];
  categories: { id: string; name: string; slug: string | null }[];
  tags: { id: string; name: string; slug: string | null }[];
}

interface PostListViewClientProps {
  posts: PostListPost[];
  parsedProps: PostListProps;
}

export function PostListViewClient({ posts, parsedProps: p }: PostListViewClientProps) {
  const layout = p.layout || 'grid';
  const columns = parseInt(p.columns || '3', 10);
  const showFeaturedImage = p.showFeaturedImage !== 'false';
  const showMeta = p.showMeta !== 'false';
  const carouselLoop = p.carouselLoop !== 'false';
  const carouselIndicators = p.carouselIndicators !== 'false';
  const unknownAuthorLabel = 'Unknown';
  const toCategoryMetaItems = (post: PostListPost) =>
    post.categories.map((category) => ({
      id: `category-${category.id}`,
      label: category.name,
      href: category.slug ? `/category/${encodeURIComponent(category.slug)}` : null,
    }));
  const toTagMetaItems = (post: PostListPost) =>
    post.tags.map((tag) => ({
      id: `tag-${tag.id}`,
      label: tag.name,
      href: tag.slug ? `/tag/${encodeURIComponent(tag.slug)}` : null,
    }));
  const items = posts.map((post) => ({
    ...post,
    href: `/posts/${post.slug || post.id}`,
    title: post.title,
    imageUrl: post.featured_image_url,
    imageAlt: post.title,
  }));
  const renderCardMeta = (post: PostListPost) => (
    <>
      {post.authors?.length > 0 ? (
        <Group gap={3} wrap="wrap" align="center">
          <PostAuthorLinks authors={post.authors} unknownLabel={unknownAuthorLabel} maxVisibleAuthors={2} />
        </Group>
      ) : null}
      {post.categories.length > 0 ? (
        <Group gap={3} wrap="wrap" align="center">
          <Text size="xs" c="dimmed">
            Category:
          </Text>
          <PostMetaLinks items={toCategoryMetaItems(post)} separatorColor="var(--mantine-color-dimmed)" />
        </Group>
      ) : null}
      {post.tags.length > 0 ? (
        <Group gap={3} wrap="wrap" align="center">
          <Text size="xs" c="dimmed">
            Tag:
          </Text>
          <PostMetaLinks items={toTagMetaItems(post)} separatorColor="var(--mantine-color-dimmed)" />
        </Group>
      ) : null}
      {post.published_at ? (
        <Text size="xs" c="dimmed">
          <DateTime value={post.published_at} />
        </Text>
      ) : null}
    </>
  );

  return (
    <ListViewShell
      items={items}
      className="post-list-block"
      emptyLabel="No posts found"
      layout={layout}
      columns={columns}
      showImage={showFeaturedImage}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
      dataScope="post-list"
      renderListMeta={
        showMeta
          ? (post) =>
              post.authors?.length > 0 ? (
                <Group gap={6} wrap="wrap" align="center">
                  <PostAuthorLinks authors={post.authors} unknownLabel={unknownAuthorLabel} maxVisibleAuthors={2} />
                  {post.published_at ? (
                    <Text size="xs" c="dimmed">
                      <DateTime value={post.published_at} />
                    </Text>
                  ) : null}
                </Group>
              ) : post.published_at ? (
                <Text size="xs" c="dimmed">
                  <DateTime value={post.published_at} />
                </Text>
              ) : null
          : undefined
      }
      renderMinimalMeta={
        showMeta
          ? (post) =>
              post.published_at ? (
                <Text size="xs" c="dimmed">
                  <DateTime value={post.published_at} />
                </Text>
              ) : null
          : undefined
      }
      renderCardsMeta={showMeta ? renderCardMeta : undefined}
      renderGridMeta={showMeta ? renderCardMeta : undefined}
      renderCarouselCardMeta={
        showMeta
          ? (post) => (
              <Group gap="xs" wrap="wrap">
                {post.authors?.length > 0 ? (
                  <PostAuthorLinks authors={post.authors} unknownLabel={unknownAuthorLabel} />
                ) : null}
                {post.published_at ? (
                  <Text size="xs" c="dimmed">
                    <DateTime value={post.published_at} />
                  </Text>
                ) : null}
              </Group>
            )
          : undefined
      }
      renderHeroMeta={
        showMeta
          ? (post, { mobile }) => (
              <Group gap="md" align="center" wrap="wrap" className={classes.heroMetaRow}>
                {post.authors?.length > 0 ? (
                  <PostAuthorLinks
                    authors={post.authors}
                    unknownLabel={unknownAuthorLabel}
                    textSize={mobile ? 'xs' : 'sm'}
                    textColor="rgba(255,255,255,0.8)"
                    avatarSize={24}
                    avatarBorderColor="white"
                    maxVisibleAuthors={mobile ? 1 : 2}
                  />
                ) : null}
                {post.published_at ? (
                  <Text
                    size={mobile ? 'xs' : 'sm'}
                    style={{ color: 'rgba(255,255,255,0.8)' }}
                    className={classes.heroMetaText}
                  >
                    <DateTime value={post.published_at} />
                  </Text>
                ) : null}
              </Group>
            )
          : undefined
      }
    />
  );
}
