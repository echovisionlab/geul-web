'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { PostStatus as PublicPostStatus } from '@echovisionlab/geul-proto/public/post_pb.ts';
import type { ContentBlockMediaItem } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { PostAction } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import { IconChevronLeft, IconChevronRight, IconList } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { SectionCard } from '@/components/core/Section';
import { TableOfContents } from '@/features/navigation/TableOfContents';
import { ContentChrome, ContentLayoutView, type DocumentLayout } from '@/features/document-layout';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import { ContentBlockMediaRuntimeProvider } from '@/features/media/ContentBlockMediaRuntimeContext';
import { CommentSection } from '@/features/post/Comment/CommentSection';
import { PostHeader } from '@/features/post/PostHeader/PostHeader';
import { PostMediaDownloadProvider } from '@/features/post/PostMediaDownloadContext';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { LocalizationNotice } from '@/features/translation/LocalizationNotice';
import { getPostMarkdownAction } from '@/lib/actions/post';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import { buildGeneratedBlockTocItems } from '@/lib/toc-items';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { downloadMarkdown } from '@/lib/utils/export';
import classes from './PostViewContent.module.css';

// Post data type (from postService.getView)
interface PostData {
  id: string;
  slug: string | null;
  title: string | null;
  summary: string | null;
  content: readonly LocalizedRichTextBlock[] | null;
  blockMedia: readonly ContentBlockMediaItem[];
  documentLayout: DocumentLayout;
  commentsEnabled: boolean;
  status: string;
  statusCode: PublicPostStatus;
  series: {
    title: string;
    currentOrder: number | null;
    prev: { id: string; slug: string | null; title: string | null } | null;
    next: { id: string; slug: string | null; title: string | null } | null;
  } | null;
  // PostHeader expects these fields too
  featuredImageUrl: string | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
  authors: { id: string; name: string | null; image: string | null }[];
  collaborators: { id: string; name: string | null; image: string | null; role: string }[];
  categories: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  locationPlace: { name: string; lat: number; lng: number; googlePlaceId?: string | null } | null;
  canEdit: boolean;
  localizationInfo?: {
    requestedLocale: string;
    displayedLocale: string;
    sourceLocale: string;
    isFallback: boolean;
    isOriginal: boolean;
    machineGenerated: boolean;
    fallbackReason: number;
    availableLocales?: string[];
  } | null;
}

interface Props {
  post: PostData;
  pathname: string;
  query?: Record<string, string | string[] | undefined>;
  requestedLocale: string;
  allowedActions?: PostAction[];
  sharePassword?: string;
  onRequestedLocaleChange?: (locale: string) => void;
}

export function PostViewContent({
  post,
  pathname,
  query,
  requestedLocale,
  allowedActions = [],
  sharePassword,
  onRequestedLocaleChange,
}: Props) {
  const t = useTranslations('postView');
  const tCommon = useTranslations('common');
  const tCommonNotifications = useTranslations('common.notifications');
  const { copy } = useCopyToClipboard();
  const markdown = useMutation({
    mutationFn: (id: string) => getPostMarkdownAction(id),
  });
  const tocItems = useMemo(() => buildGeneratedBlockTocItems(post.content), [post.content]);
  const shareValue = query?.share;
  const shareToken = Array.isArray(shareValue) ? shareValue[0] : shareValue;

  const handleShare = async () => {
    const shareData = {
      title: post.title || tCommon('states.untitled'),
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        copy(shareData.url, { successMessage: tCommon('messages.urlCopiedToClipboard') });
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        copy(shareData.url, { successMessage: tCommon('messages.urlCopiedToClipboard') });
      }
    }
  };

  const handleExport = async (format: 'markdown' | 'pdf') => {
    try {
      if (format === 'pdf') {
        window.print();
      } else {
        const result = await markdown.mutateAsync(post.id);
        if (result.error) {
          notifications.show({ message: result.error, color: 'red' });
          return;
        }
        downloadMarkdown(result.title || tCommon('states.untitled'), result.markdown || '');
      }
    } catch {
      notifications.show({ message: tCommonNotifications('exportFailed'), color: 'red' });
    }
  };

  return (
    <ContentBlockMediaRuntimeProvider items={post.blockMedia}>
      <PostMediaDownloadProvider
        idOrSlug={post.slug || post.id}
        requestedLocale={requestedLocale}
        shareToken={shareToken}
        sharePassword={sharePassword}
      >
        <ContentLayoutView
          layout={post.documentLayout}
          chrome={
            <ContentChrome>
              <PostHeader
                post={post}
                onShare={handleShare}
                onExport={handleExport}
                languageMenu={
                  post.localizationInfo ? (
                    <ContentLanguageMenu
                      pathname={pathname}
                      query={query}
                      requestedLocale={requestedLocale}
                      localizationInfo={post.localizationInfo}
                      onRequestedLocaleChange={onRequestedLocaleChange}
                    />
                  ) : null
                }
              />
            </ContentChrome>
          }
        >
          <div className={classes.contentFlow}>
            {post.localizationInfo ? (
              <LocalizationNotice
                pathname={pathname}
                query={query}
                requestedLocale={requestedLocale}
                localizationInfo={post.localizationInfo}
                variant="subtle"
                onRequestedLocaleChange={onRequestedLocaleChange}
              />
            ) : null}

            {/* Series Navigation */}
            {post.series && (
              <SectionCard>
                <Stack gap="sm">
                  <Group gap="xs">
                    <IconList size={16} />
                    <Text size="sm" fw={500}>
                      {post.series.title}
                    </Text>
                    {post.series.currentOrder && (
                      <LabelBadge size="sm">{t('series.part', { count: post.series.currentOrder })}</LabelBadge>
                    )}
                  </Group>
                  <Group justify="space-between">
                    {post.series.prev ? (
                      <Button
                        component={Link}
                        href={`/posts/${post.series.prev.slug || post.series.prev.id}`}
                        emphasis="low"
                        size="xs"
                        leftSection={<IconChevronLeft size={14} />}
                      >
                        {post.series.prev.title || t('series.previousFallback')}
                      </Button>
                    ) : (
                      <div />
                    )}
                    {post.series.next ? (
                      <Button
                        component={Link}
                        href={`/posts/${post.series.next.slug || post.series.next.id}`}
                        emphasis="low"
                        size="xs"
                        rightSection={<IconChevronRight size={14} />}
                      >
                        {post.series.next.title || t('series.nextFallback')}
                      </Button>
                    ) : (
                      <div />
                    )}
                  </Group>
                </Stack>
              </SectionCard>
            )}

            {/* Content */}
            {post.content && post.content.length > 0 ? (
              <Box className="prose">
                {post.content.map((block) => (
                  <GeneratedRichTextBlockView
                    key={block.id}
                    block={block}
                    requestedLocale={requestedLocale}
                    allowStandaloneExternalVideo
                  />
                ))}
              </Box>
            ) : null}

            {/* Comments */}
            <div className="print-hide">
              <CommentSection
                postId={post.id}
                commentsEnabled={post.commentsEnabled}
                status={post.statusCode}
                canModerate={allowedActions.includes(PostAction.MODERATE_COMMENTS)}
              />
            </div>
          </div>
          <TableOfContents items={tocItems} />
        </ContentLayoutView>
      </PostMediaDownloadProvider>
    </ContentBlockMediaRuntimeProvider>
  );
}
