'use client';

import {
  LayoutContainer as DsLayoutContainer,
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useMemo, type ComponentProps } from 'react';
import type { PostStatus as PublicPostStatus } from '@echovisionlab/geul-proto/public/post_pb.ts';
import type { ContentBlockMediaItem } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { PostAction } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import { POST_ACTION } from '@/features/post/post-wire-values';
import { IconChevronLeft, IconChevronRight, IconList } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useLocale } from 'react-aria';

import { notifications } from '@/components/core/Notification';
import { LabelBadge } from '@/components/core/Badge';
import { TextButton } from '@/components/core/TextButton';
import { SectionCard } from '@/components/core/Section';
import { TableOfContents } from '@/features/navigation/TableOfContents';
import { ContentChrome, ContentLayoutView, type DocumentLayout } from '@/features/document-layout';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import { ContentBlockMediaRuntimeProvider } from '@/features/media/ContentBlockMediaRuntimeContext';
import { CommentSection } from '@/features/post/Comment/CommentSection';
import { PostHeader } from '@/features/post/PostHeader/PostHeader';
import { PostMediaDownloadProvider } from '@/features/post/PostMediaDownloadContext';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { getPostMarkdownAction } from '@/lib/actions/post';
import { buildGeneratedBlockTocItems } from '@/lib/toc-items';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { downloadMarkdown } from '@/lib/utils/export';
import { getLocaleDirection } from '@/lib/i18n/locale';
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
  markdownAction?: typeof getPostMarkdownAction;
  commentBindings?: Pick<ComponentProps<typeof CommentSection>, 'listAction' | 'sessionSnapshot'>;
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
  markdownAction = getPostMarkdownAction,
  commentBindings,
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
  const markdown = useMutation({
    mutationFn: (id: string) => markdownAction(id),
  });
  const contentLanguage =
    post.localizationInfo?.displayedLocale || post.localizationInfo?.sourceLocale || requestedLocale;
  const { direction } = useLocale();
  const PreviousIcon = direction === 'rtl' ? IconChevronRight : IconChevronLeft;
  const NextIcon = direction === 'rtl' ? IconChevronLeft : IconChevronRight;
  const tocItems = useMemo(() => buildGeneratedBlockTocItems(post.content), [post.content]);
  const shareValue = query?.share;
  const shareToken = Array.isArray(shareValue) ? shareValue[0] : shareValue;

  const handleExport = async (format: 'markdown' | 'pdf') => {
    try {
      if (format === 'pdf') {
        window.print();
      } else {
        const result = await markdown.mutateAsync(post.id);
        if (result.error) {
          notifications.show({ message: result.error, tone: 'danger' });
          return;
        }
        downloadMarkdown(result.title || tCommon('states.untitled'), result.markdown || '');
      }
    } catch {
      notifications.show({ message: tCommonNotifications('exportFailed'), tone: 'danger' });
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
            // The plain header shares the body's reading column; a hero keeps its full-width image.
            <ContentChrome measure={post.featuredImageUrl ? 'full' : 'reading'}>
              <PostHeader
                post={post}
                onExport={handleExport}
                exportingMarkdown={markdown.isPending}
                languageControl={
                  post.localizationInfo ? (
                    <ContentLanguageMenu
                      contrast={post.featuredImageUrl ? 'inverse' : 'standard'}
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
          <TableOfContents items={tocItems} enabled={!post.documentLayout.hideTableOfContents}>
            <DsLayoutInset inline={post.featuredImageUrl ? 'md' : 'none'}>
              <div className={classes.contentFlow}>
                {/* Content */}
                {post.content && post.content.length > 0 ? (
                  <div
                    className="prose"
                    data-reading-measure=""
                    lang={contentLanguage}
                    dir={getLocaleDirection(contentLanguage)}
                  >
                    {post.content.map((block) => (
                      <GeneratedRichTextBlockView
                        key={block.id}
                        block={block}
                        requestedLocale={requestedLocale}
                        allowStandaloneExternalVideo
                      />
                    ))}
                  </div>
                ) : null}

                {/* Series Navigation */}
                {post.series && (
                  <DsLayoutContainer size="reading" inset="none" placement="start">
                    <SectionCard appearance="plain" padding="none" withBorder={false}>
                      <DsLayoutStack gap="sm" role="navigation" aria-label={post.series.title}>
                        <DsLayoutInline gap="xs">
                          <IconList size={16} />
                          <DsText size="sm" weight="medium">
                            {post.series.title}
                          </DsText>
                          {post.series.currentOrder && (
                            <LabelBadge size="sm">{t('series.part', { count: post.series.currentOrder })}</LabelBadge>
                          )}
                        </DsLayoutInline>
                        {/* Series links are screen navigation; paper keeps the series name and part only. */}
                        <div className="print-hide">
                          <DsLayoutInline justify="between">
                            {post.series.prev ? (
                              <TextButton
                                href={`/posts/${post.series.prev.slug || post.series.prev.id}`}
                                appearance="muted"
                                size="xs"
                                gap="xs"
                              >
                                <PreviousIcon size={16} aria-hidden />
                                <span>{post.series.prev.title || t('series.previousFallback')}</span>
                              </TextButton>
                            ) : (
                              <div />
                            )}
                            {post.series.next ? (
                              <TextButton
                                href={`/posts/${post.series.next.slug || post.series.next.id}`}
                                appearance="muted"
                                size="xs"
                                gap="xs"
                              >
                                <span>{post.series.next.title || t('series.nextFallback')}</span>
                                <NextIcon size={16} aria-hidden />
                              </TextButton>
                            ) : (
                              <div />
                            )}
                          </DsLayoutInline>
                        </div>
                      </DsLayoutStack>
                    </SectionCard>
                  </DsLayoutContainer>
                )}

                {/* Comments */}
                <div className="print-hide">
                  <DsLayoutContainer size="reading" inset="none" placement="start">
                    <CommentSection
                      listAction={commentBindings?.listAction}
                      sessionSnapshot={commentBindings?.sessionSnapshot}
                      postId={post.id}
                      shareToken={shareToken}
                      sharePassword={sharePassword}
                      commentsEnabled={post.commentsEnabled}
                      status={post.statusCode}
                      canModerate={allowedActions.includes(POST_ACTION.MODERATE_COMMENTS)}
                    />
                  </DsLayoutContainer>
                </div>
              </div>
            </DsLayoutInset>
          </TableOfContents>
        </ContentLayoutView>
      </PostMediaDownloadProvider>
    </ContentBlockMediaRuntimeProvider>
  );
}
