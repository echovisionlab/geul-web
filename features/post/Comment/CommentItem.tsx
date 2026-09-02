'use client';

import { useState } from 'react';
import {
  IconAlertTriangle,
  IconChevronDown,
  IconChevronUp,
  IconDots,
  IconEdit,
  IconMessageReply,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Avatar, Box, Collapse, Flex, Group, Loader, Modal, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { Button } from '@/components/core/Button';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { IconButton } from '@/components/core/IconButton';
import { Textarea } from '@/components/core/Input';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { SectionCard } from '@/components/core/Section';
import { Tooltip } from '@/components/core/Tooltip';
import {
  deleteCommentAction,
  loadMoreRepliesAction,
  updateCommentAction,
  type CommentNode,
} from '@/lib/actions/comment';
import { useSession } from '@/lib/auth/client';
import { useLocale } from '@/lib/providers/LocaleProvider';
import { formatRelativeTime } from '@/lib/utils/formatDate';
import { CommentForm } from './CommentForm';
import { resolveCommentActions } from './comment-permissions';

interface CommentItemProps {
  comment: CommentNode;
  postId: string;
  depth?: number;
  canReply?: boolean;
  canModerate?: boolean;
}

const MAX_DEPTH = 6;

export function CommentItem({ comment, postId, depth = 0, canReply = true, canModerate = false }: CommentItemProps) {
  const t = useTranslations('comments.item');
  const tForm = useTranslations('comments.form');
  const tCommonActions = useTranslations('common.actions');
  const tCommonStates = useTranslations('common.states');
  const { data: session } = useSession();
  const locale = useLocale();
  const dateTime = useDateTimeFormatter();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [replyOpened, { toggle: toggleReply, close: closeReply }] = useDisclosure(false);
  const [repliesOpened, { toggle: toggleReplies }] = useDisclosure(true);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const queryClient = useQueryClient();

  // State for dynamically loaded replies
  const [loadedReplies, setLoadedReplies] = useState<CommentNode[]>([]);
  const [replyCursor, setReplyCursor] = useState<string | undefined>(undefined);
  const [hasMoreReplies, setHasMoreReplies] = useState(comment.hasMoreReplies);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);

  // Calculate remaining replies to load
  const displayedReplies = [...comment.replies, ...loadedReplies];
  const remainingReplies = comment.totalReplyCount - displayedReplies.length;

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; content: string }) => updateCommentAction(data.id, data.content),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['comment', 'list', postId] });
      notifications.show({ message: t('notifications.updated'), color: 'green' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (data: { id: string }) => deleteCommentAction(data.id),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      closeDeleteModal();
      queryClient.invalidateQueries({ queryKey: ['comment', 'list', postId] });
      notifications.show({ message: t('notifications.deleted'), color: 'green' });
    },
  });

  const isOwnComment = Boolean(session?.user && session.user.id === comment.memberId);
  const { canEdit, canDelete } = resolveCommentActions({
    isDeleted: comment.isDeleted,
    isOwnComment,
    canModerate,
  });

  const handleUpdate = () => {
    if (!editContent.trim()) {
      return;
    }
    updateMutation.mutate({ id: comment.id, content: editContent.trim() });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id: comment.id });
  };

  const handleLoadMoreReplies = async () => {
    setIsLoadingReplies(true);
    try {
      // Use the last displayed reply's ID as cursor
      const lastReply = displayedReplies[displayedReplies.length - 1];
      const cursor = replyCursor || (lastReply ? lastReply.id : undefined);

      const result = await loadMoreRepliesAction(comment.id, { limit: 10, cursor });
      setLoadedReplies((prev) => [...prev, ...result.replies]);
      setReplyCursor(result.nextCursor);
      setHasMoreReplies(result.hasMore);
    } catch {
      notifications.show({ message: t('notifications.loadRepliesFailed'), color: 'red' });
    } finally {
      setIsLoadingReplies(false);
    }
  };

  const isEdited = new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 60000;

  return (
    <>
      <Modal opened={deleteModalOpened} onClose={closeDeleteModal} title={t('deleteModal.title')} centered size="sm">
        <Stack gap="md">
          <Flex align="center" gap="md">
            <IconAlertTriangle size={24} color="var(--mantine-color-red-6)" />
            <Text size="sm">{t('deleteModal.body')}</Text>
          </Flex>
          <Group justify="flex-end" gap="sm">
            <Button tone="neutral" emphasis="medium" onClick={closeDeleteModal}>
              {tCommonActions('cancel')}
            </Button>
            <Button tone="danger" onClick={handleDelete} loading={deleteMutation.isPending}>
              {tCommonActions('delete')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Box
        pl={depth > 0 ? 'md' : 0}
        style={{
          borderLeft: depth > 0 ? '2px solid var(--mantine-color-gray-3)' : 'none',
        }}
      >
        <SectionCard padding="sm" radius={0} withBorder={depth === 0}>
          <Stack gap="xs">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <Tooltip
                  label={comment.isDeleted ? t('states.deletedUser') : comment.authorName || tCommonStates('anonymous')}
                  withArrow
                >
                  <Avatar
                    src={comment.isDeleted ? null : comment.authorImageUrl}
                    size="md"
                    radius="xl"
                    color={comment.isDeleted ? 'gray' : 'blue'}
                  >
                    {comment.isDeleted ? '?' : comment.authorName?.charAt(0)?.toUpperCase() || 'A'}
                  </Avatar>
                </Tooltip>
                <Stack gap={2}>
                  <Text size="sm" fw={600} c={comment.isDeleted ? 'dimmed' : undefined}>
                    {comment.isDeleted ? t('states.deleted') : comment.authorName || tCommonStates('anonymous')}
                  </Text>
                  <Group gap="xs">
                    <Tooltip label={dateTime.dateTime(comment.createdAt)} withArrow>
                      <Text size="xs" c="dimmed" style={{ cursor: 'default' }}>
                        {formatRelativeTime(comment.createdAt, locale, dateTime.timeZone)}
                      </Text>
                    </Tooltip>
                    {isEdited && (
                      <Tooltip
                        label={t('editedTooltip', {
                          value: formatRelativeTime(comment.updatedAt, locale, dateTime.timeZone) ?? '',
                        })}
                        withArrow
                      >
                        <Text size="xs" c="dimmed" fs="italic" style={{ cursor: 'default' }}>
                          {t('edited')}
                        </Text>
                      </Tooltip>
                    )}
                  </Group>
                </Stack>
              </Group>

              {(canEdit || canDelete) && (
                <DropdownMenu size="compact" placement="bottom-end" arrow>
                  <DropdownMenu.Target>
                    <Tooltip label={t('actions.moreOptions')} withArrow>
                      <IconButton tone="neutral" emphasis="low" size="sm" aria-label={t('actions.moreOptions')}>
                        <IconDots size={16} />
                      </IconButton>
                    </Tooltip>
                  </DropdownMenu.Target>
                  <DropdownMenu.Dropdown>
                    {canEdit ? (
                      <DropdownMenu.Item icon={<IconEdit size={14} />} onClick={() => setIsEditing(true)}>
                        {tCommonActions('edit')}
                      </DropdownMenu.Item>
                    ) : null}
                    {canDelete ? (
                      <DropdownMenu.Item icon={<IconTrash size={14} />} tone="danger" onClick={openDeleteModal}>
                        {tCommonActions('delete')}
                      </DropdownMenu.Item>
                    ) : null}
                  </DropdownMenu.Dropdown>
                </DropdownMenu>
              )}
            </Group>

            {isEditing ? (
              <Stack gap="xs">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  autosize
                  minRows={1}
                  maxRows={6}
                  autoFocus
                  radius={0}
                />
                <Group justify="flex-end" gap="xs">
                  <Button
                    tone="neutral"
                    emphasis="medium"
                    size="xs"
                    onClick={() => {
                      setIsEditing(false);
                      setEditContent(comment.content);
                    }}
                  >
                    {tCommonActions('cancel')}
                  </Button>
                  <Button
                    size="xs"
                    onClick={handleUpdate}
                    loading={updateMutation.isPending}
                    disabled={!editContent.trim()}
                  >
                    {tCommonActions('save')}
                  </Button>
                </Group>
              </Stack>
            ) : (
              <Text
                size="sm"
                style={{ whiteSpace: 'pre-wrap' }}
                c={comment.isDeleted ? 'dimmed' : undefined}
                fs={comment.isDeleted ? 'italic' : undefined}
              >
                {comment.content}
              </Text>
            )}

            {!comment.isDeleted && (
              <Group gap="xs">
                {session?.user && canReply && depth < MAX_DEPTH && (
                  <Button
                    tone="neutral"
                    emphasis="low"
                    size="xs"
                    leftSection={<IconMessageReply size={14} />}
                    onClick={toggleReply}
                  >
                    {tCommonActions('reply')}
                  </Button>
                )}
                {displayedReplies.length > 0 && (
                  <Button
                    tone="neutral"
                    emphasis="low"
                    size="xs"
                    leftSection={repliesOpened ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                    onClick={toggleReplies}
                  >
                    {t(repliesOpened ? 'actions.hideReplies' : 'actions.showReplies', {
                      count: displayedReplies.length,
                    })}
                    {remainingReplies > 0 ? ` ${t('actions.moreReplies', { count: remainingReplies })}` : ''}
                  </Button>
                )}
              </Group>
            )}

            <Collapse expanded={replyOpened} transitionDuration={200}>
              <Box pt="xs">
                <CommentForm
                  postId={postId}
                  parentId={comment.id}
                  placeholder={tForm('replyPlaceholder')}
                  autoFocus
                  onSuccess={closeReply}
                  onCancel={closeReply}
                />
              </Box>
            </Collapse>
          </Stack>
        </SectionCard>

        {displayedReplies.length > 0 && (
          <Collapse expanded={repliesOpened} transitionDuration={200}>
            <Stack gap="sm" mt="sm">
              {displayedReplies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  depth={depth + 1}
                  canReply={canReply}
                  canModerate={canModerate}
                />
              ))}

              {/* Load more replies button */}
              {hasMoreReplies && remainingReplies > 0 && (
                <Button
                  tone="neutral"
                  emphasis="low"
                  size="xs"
                  leftSection={isLoadingReplies ? <Loader size={14} type="dots" /> : <IconChevronDown size={14} />}
                  onClick={handleLoadMoreReplies}
                  disabled={isLoadingReplies}
                  ml={depth > 0 ? 'md' : 0}
                >
                  {t('actions.loadMoreReplies', { count: remainingReplies })}
                </Button>
              )}
            </Stack>
          </Collapse>
        )}
      </Box>
    </>
  );
}
