'use client';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useCallback, useState } from 'react';
import type { PostStatus } from '@echovisionlab/geul-proto/public/post_pb.ts';
import { PUBLIC_POST_STATUS } from '@/features/post/post-wire-values';
import { IconAlertCircle } from '@tabler/icons-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { NavigationLink as Anchor } from '@/components/core/Navigation';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { PageLoader } from '@/features/site/PageLoader';
import { listCommentsAction, type CommentNode, type CommentReadAccess } from '@/lib/actions/comment';
import { useSessionContext } from '@/lib/providers/SessionProvider';
import type { SessionData } from '@/lib/session-data';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';

interface CommentSectionProps extends CommentReadAccess {
  listAction?: typeof listCommentsAction;
  sessionSnapshot?: SessionData | null;
  postId: string;
  commentsEnabled: boolean;
  status: PostStatus;
  canModerate?: boolean;
}

export function CommentSection(props: CommentSectionProps) {
  if (!props.commentsEnabled) {
    return null;
  }
  return <EnabledCommentSection {...props} />;
}

function EnabledCommentSection({
  postId,
  commentsEnabled,
  status,
  canModerate = false,
  listAction = listCommentsAction,
  sessionSnapshot,
  shareToken,
  sharePassword,
}: CommentSectionProps) {
  const t = useTranslations('comments.section');
  const tCommonLabels = useTranslations('common.labels');
  const sessionContext = useSessionContext();
  if (sessionSnapshot === undefined && !sessionContext) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  const session = sessionSnapshot === undefined ? sessionContext?.data : sessionSnapshot;
  const [localComments, setLocalComments] = useState<CommentNode[]>([]);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['comment', 'list', postId, { shareToken, sharePassword }],
    queryFn: ({ pageParam }) =>
      listAction(postId, { cursor: pageParam, shareToken, sharePassword }).then(unwrapQueryResult),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    initialPageParam: undefined as string | undefined,
  });

  // Merge all pages of comments
  const allComments = data?.pages.flatMap((page) => page.comments) ?? [];
  const totalCount = data?.pages[0]?.totalCount ?? 0;

  // Callback to add a new comment at the correct position
  const handleNewComment = useCallback((newComment?: CommentNode) => {
    if (newComment) {
      setLocalComments((prev) => [...prev, newComment]);
    }
  }, []);

  const canComment = commentsEnabled && status === PUBLIC_POST_STATUS.PUBLISHED;

  if (isLoading) {
    return (
      <div style={{ position: 'relative', minHeight: 200 }}>
        <PageLoader message={t('loading')} />
      </div>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title={tCommonLabels('error')} tone="danger">
        {t('loadFailed')}
      </Alert>
    );
  }

  const displayedComments = [...allComments, ...localComments];
  const remainingCount = totalCount - displayedComments.length;

  return (
    <DsLayoutStack gap="lg">
      {/* A document-level section after the body: the level below the post title, at the h3 visual size. */}
      <DsHeading level={2} scale={3}>
        {t('title')}{' '}
        {totalCount > 0 && (
          <DsText as="span" tone="secondary" size="lg">
            ({totalCount})
          </DsText>
        )}
      </DsHeading>

      {!canComment ? (
        <DsText tone="secondary" size="sm">
          {t('disabled')}
        </DsText>
      ) : session?.user ? (
        <CommentForm postId={postId} onSuccess={handleNewComment} />
      ) : (
        <DsText tone="secondary" size="sm">
          {t.rich('loginPrompt', {
            login: (chunks) => (
              <Anchor href="/login" appearance="quiet">
                {chunks}
              </Anchor>
            ),
          })}
        </DsText>
      )}

      {displayedComments.length > 0 && (
        <DsLayoutStack gap="md">
          {displayedComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              shareToken={shareToken}
              sharePassword={sharePassword}
              canReply={canComment}
              canModerate={canModerate}
            />
          ))}

          {hasNextPage && (
            <Button
              tone="neutral"
              emphasis="low"
              fullWidth
              onClick={() => fetchNextPage()}
              loading={isFetchingNextPage}
            >
              {remainingCount > 0 ? t('loadMoreCount', { count: remainingCount }) : t('loadMore')}
            </Button>
          )}
        </DsLayoutStack>
      )}
    </DsLayoutStack>
  );
}
