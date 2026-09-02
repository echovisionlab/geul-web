'use client';

import { useState } from 'react';
import { IconSend } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Button } from '@/components/core/Button';
import { Textarea } from '@/components/core/Input';
import { createCommentAction, type CommentNode } from '@/lib/actions/comment';

const MAX_LENGTH = 10000;

interface CommentFormProps {
  postId: string;
  parentId?: string;
  onSuccess?: (comment?: CommentNode) => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function CommentForm({
  postId,
  parentId,
  onSuccess,
  onCancel,
  placeholder,
  autoFocus = false,
}: CommentFormProps) {
  const t = useTranslations('comments.form');
  const tCommonActions = useTranslations('common.actions');
  const [content, setContent] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: { postId: string; content: string; parentId?: string }) =>
      createCommentAction(data.postId, data.content, data.parentId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['comment', 'list', postId] });
      notifications.show({
        message: parentId ? t('notifications.replyPosted') : t('notifications.commentPosted'),
        color: 'green',
      });
      // Pass the new comment to onSuccess if it's a top-level comment
      if (result.comment && !parentId) {
        const newComment: CommentNode = {
          ...result.comment,
          replies: [],
          hasMoreReplies: false,
          totalReplyCount: 0,
        };
        onSuccess?.(newComment);
      } else {
        onSuccess?.();
      }
    },
  });

  const isOverLimit = content.length > MAX_LENGTH;

  const handleSubmit = () => {
    if (!content.trim() || isOverLimit) {
      return;
    }
    createMutation.mutate({ postId, content: content.trim(), parentId: parentId || undefined });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Stack gap="xs">
      <Textarea
        placeholder={placeholder ?? (parentId ? t('replyPlaceholder') : t('placeholder'))}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        autosize
        minRows={1}
        maxRows={6}
        autoFocus={autoFocus}
        radius={0}
      />
      <Group justify="space-between" gap="xs">
        <Text size="xs" c={isOverLimit ? 'red' : 'dimmed'}>
          {content.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
        </Text>
        <Group gap="xs">
          {onCancel && (
            <Button emphasis="low" size="xs" onClick={onCancel}>
              {tCommonActions('cancel')}
            </Button>
          )}
          <Button
            size="xs"
            onClick={handleSubmit}
            loading={createMutation.isPending}
            disabled={!content.trim() || isOverLimit}
            leftSection={<IconSend size={14} />}
          >
            {parentId ? tCommonActions('reply') : t('actions.comment')}
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
