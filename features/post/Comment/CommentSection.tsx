'use client';

import { useCallback, useState } from 'react';
import { PostStatus } from '@echovisionlab/geul-proto/public/post_pb.ts';
import { IconAlertCircle, IconChevronDown } from '@tabler/icons-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Anchor, Box, Divider, rem, Stack, Text, Title } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { PageLoader } from '@/features/site/PageLoader';
import { listCommentsAction, type CommentNode } from '@/lib/actions/comment';
import { useSession } from '@/lib/auth/client';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';

interface CommentSectionProps {
  postId: string;
  commentsEnabled: boolean;
  status: PostStatus;
  canModerate?: boolean;
}

export function CommentSection({ postId, commentsEnabled, status, canModerate = false }: CommentSectionProps) {
  const t = useTranslations('comments.section');
  const tCommonLabels = useTranslations('common.labels');
  const { data: session } = useSession();
  const [localComments, setLocalComments] = useState<CommentNode[]>([]);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['comment', 'list', postId],
    queryFn: ({ pageParam }) => listCommentsAction(postId, { cursor: pageParam }),
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

  const canComment = commentsEnabled && status === PostStatus.PUBLISHED;

  if (isLoading) {
    return (
      <Box pos="relative" mih={200}>
        <PageLoader message={t('loading')} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        icon={<IconAlertCircle style={{ width: rem(16), height: rem(16) }} />}
        title={tCommonLabels('error')}
        tone="danger"
      >
        {t('loadFailed')}
      </Alert>
    );
  }

  const displayedComments = [...allComments, ...localComments];
  const remainingCount = totalCount - displayedComments.length;

  return (
    <Stack gap="lg">
      <Divider />

      <Title order={3}>
        {t('title')}{' '}
        {totalCount > 0 && (
          <Text component="span" c="dimmed" size="lg">
            ({totalCount})
          </Text>
        )}
      </Title>

      {!canComment ? (
        <Text c="dimmed" size="sm">
          {t('disabled')}
        </Text>
      ) : session?.user ? (
        <CommentForm postId={postId} onSuccess={handleNewComment} />
      ) : (
        <Text c="dimmed" size="sm">
          {t.rich('loginPrompt', {
            login: (chunks) => (
              <Anchor href="/login" underline="hover">
                {chunks}
              </Anchor>
            ),
          })}
        </Text>
      )}

      {displayedComments.length > 0 && (
        <Stack gap="md">
          {displayedComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              canReply={canComment}
              canModerate={canModerate}
            />
          ))}

          {hasNextPage && (
            <Button
              tone="neutral"
              emphasis="low"
              fullWidth
              leftSection={<IconChevronDown size={16} />}
              onClick={() => fetchNextPage()}
              loading={isFetchingNextPage}
            >
              {remainingCount > 0 ? t('loadMoreCount', { count: remainingCount }) : t('loadMore')}
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}
