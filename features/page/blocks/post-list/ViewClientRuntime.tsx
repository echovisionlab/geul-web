'use client';
import { useTranslations } from 'next-intl';
import { getCollectionMetrics } from '@/components/core/Collection/collection-contract';
import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { DateTime } from '@/features/date-time/DateTime';
import { ListViewShell } from '../ListViewShell';
import { PostAuthorLinks } from './PostAuthorLinks';
import { PostMetaLinks } from './PostMetaLinks';
import type { PostListProps } from './schema';
interface PostListPost {
  id: string;
  slug: string | null;
  title: string | null;
  featured_image_url: string | null;
  published_at: string | null;
  authors: {
    id: string;
    name: string | null;
    image: string | null;
  }[];
  categories: {
    id: string;
    name: string;
    slug: string | null;
  }[];
  tags: {
    id: string;
    name: string;
    slug: string | null;
  }[];
}
export interface PostListViewClientProps {
  posts: PostListPost[];
  parsedProps: PostListProps;
}
export function PostListViewClient({ posts, parsedProps: p }: PostListViewClientProps) {
  const tCommon = useTranslations('common');
  const metrics = getCollectionMetrics(p.itemSize);
  const layout = p.layout || 'grid';
  const columns = parseInt(p.columns || '3', 10);
  const showFeaturedImage = p.showFeaturedImage !== 'false';
  const showMeta = p.showMeta !== 'false';
  const carouselLoop = p.carouselLoop !== 'false';
  const carouselIndicators = p.carouselIndicators !== 'false';
  const unknownAuthorLabel = tCommon('states.unknownAuthor');
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
        <DsLayoutInline gap="xxs" wrap="wrap" align="center">
          <PostAuthorLinks
            authors={post.authors}
            unknownLabel={unknownAuthorLabel}
            textSize={metrics.metaSize}
            maxVisibleAuthors={2}
          />
        </DsLayoutInline>
      ) : null}
      {post.categories.length > 0 ? (
        <DsLayoutInline gap="xxs" wrap="wrap" align="center">
          <DsText size={metrics.metaSize} tone="secondary">
            {tCommon('entities.category')}:
          </DsText>
          <PostMetaLinks items={toCategoryMetaItems(post)} separatorTone="secondary" textSize={metrics.metaSize} />
        </DsLayoutInline>
      ) : null}
      {post.tags.length > 0 ? (
        <DsLayoutInline gap="xxs" wrap="wrap" align="center">
          <DsText size={metrics.metaSize} tone="secondary">
            {tCommon('entities.tag')}:
          </DsText>
          <PostMetaLinks items={toTagMetaItems(post)} separatorTone="secondary" textSize={metrics.metaSize} />
        </DsLayoutInline>
      ) : null}
      {post.published_at ? (
        <DsText size={metrics.metaSize} tone="secondary">
          <DateTime value={post.published_at} />
        </DsText>
      ) : null}
    </>
  );
  return (
    <ListViewShell
      items={items}
      className="post-list-block"
      emptyLabel={tCommon('messages.noPostsFound')}
      layout={layout}
      itemSize={p.itemSize}
      columns={columns}
      showImage={showFeaturedImage}
      carouselLoop={carouselLoop}
      carouselIndicators={carouselIndicators}
      dataScope="post-list"
      renderListMeta={
        showMeta
          ? (post) =>
              post.authors?.length > 0 ? (
                <DsLayoutInline gap="xxs" wrap="wrap" align="center">
                  <PostAuthorLinks
                    authors={post.authors}
                    unknownLabel={unknownAuthorLabel}
                    textSize={metrics.metaSize}
                    maxVisibleAuthors={2}
                  />
                  {post.published_at ? (
                    <DsText size={metrics.metaSize} tone="secondary">
                      <DateTime value={post.published_at} />
                    </DsText>
                  ) : null}
                </DsLayoutInline>
              ) : post.published_at ? (
                <DsText size={metrics.metaSize} tone="secondary">
                  <DateTime value={post.published_at} />
                </DsText>
              ) : null
          : undefined
      }
      renderMinimalMeta={
        showMeta
          ? (post) =>
              post.published_at ? (
                <DsText size={metrics.metaSize} tone="secondary">
                  <DateTime value={post.published_at} />
                </DsText>
              ) : null
          : undefined
      }
      renderCardsMeta={showMeta ? renderCardMeta : undefined}
      renderGridMeta={showMeta ? renderCardMeta : undefined}
      renderCarouselCardMeta={
        showMeta
          ? (post) => (
              <DsLayoutInline gap="xs" wrap="wrap">
                {post.authors?.length > 0 ? (
                  <PostAuthorLinks
                    authors={post.authors}
                    unknownLabel={unknownAuthorLabel}
                    textSize={metrics.metaSize}
                  />
                ) : null}
                {post.published_at ? (
                  <DsText size={metrics.metaSize} tone="secondary">
                    <DateTime value={post.published_at} />
                  </DsText>
                ) : null}
              </DsLayoutInline>
            )
          : undefined
      }
      renderHeroMeta={
        showMeta
          ? (post, { mobile }) => (
              <DsLayoutInline gap="md" align="center" wrap="wrap">
                {post.authors?.length > 0 ? (
                  <PostAuthorLinks
                    authors={post.authors}
                    unknownLabel={unknownAuthorLabel}
                    textSize={mobile ? 'xs' : 'sm'}
                    textColor="inverse"
                    avatarSize="sm"
                    maxVisibleAuthors={mobile ? 1 : 2}
                  />
                ) : null}
                {post.published_at ? (
                  <DsText contrast="image" tone="inverse" size={mobile ? 'xs' : 'sm'}>
                    <DateTime value={post.published_at} />
                  </DsText>
                ) : null}
              </DsLayoutInline>
            )
          : undefined
      }
    />
  );
}
