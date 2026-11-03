'use client';

import { HierarchyIndent } from '@/components/core/Hierarchy';

import { ConfirmationDialog } from '@/features/confirmation';

import { SectionCard as DsSectionCard, SectionCard } from '@/components/core/Section';
import { DisclosureRegion } from '@/components/core/Disclosure';

import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useEffect, useRef, useId, useState } from 'react';
import { IconAlertTriangle, IconDots, IconEdit, IconMessageReply, IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Avatar, StatusIcon } from '@/components/core/Display';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { Button, SaveButton } from '@/components/core/Button';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { IconButton } from '@/components/core/IconButton';
import { Textarea } from '@/components/core/Input';
// View pages load menu code on first interaction.
import { OnDemandDropdownMenu as DropdownMenu } from '@/components/core/DropdownMenu/OnDemandDropdownMenu';

import { OnDemandTooltip as Tooltip } from '@/components/core/Tooltip/OnDemandTooltip';
import {
  deleteCommentAction,
  loadMoreRepliesAction,
  updateCommentAction,
  type CommentNode,
  type CommentReadAccess,
} from '@/lib/actions/comment';
import { useSession } from '@/lib/auth/client';
import { useLocale } from '@/lib/providers/LocaleProvider';
import { formatRelativeTime } from '@/lib/utils/formatDate';
import { CommentForm } from './CommentForm';
import { resolveCommentActions } from './comment-permissions';

interface CommentItemProps extends CommentReadAccess {
  comment: CommentNode;
  postId: string;
  depth?: number;
  canReply?: boolean;
  canModerate?: boolean;
}

const MAX_DEPTH = 6;

export function CommentItem(props: CommentItemProps) {
  return (
    <CommentItemSession
      key={`${props.postId}:${props.comment.id}:${props.shareToken}:${props.sharePassword}`}
      {...props}
    />
  );
}
function CommentItemSession({
  comment,
  postId,
  depth = 0,
  canReply = true,
  canModerate = false,
  shareToken,
  sharePassword,
}: CommentItemProps) {
  const active = useRef(true);
  const repliesPending = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const replyPanelId = useId();
  const repliesPanelId = useId();
  const tModalActions = useTranslations('common.actions');
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
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['comment', 'list', postId] });
      notifications.show({ message: t('notifications.updated'), tone: 'positive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (data: { id: string }) => deleteCommentAction(data.id),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      closeDeleteModal();
      queryClient.invalidateQueries({ queryKey: ['comment', 'list', postId] });
      notifications.show({ message: t('notifications.deleted'), tone: 'positive' });
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
    if (repliesPending.current) {
      return;
    }
    repliesPending.current = true;
    setIsLoadingReplies(true);
    try {
      // Use the last displayed reply's ID as cursor
      const lastReply = displayedReplies[displayedReplies.length - 1];
      const cursor = replyCursor || (lastReply ? lastReply.id : undefined);

      const result = await loadMoreRepliesAction(comment.id, {
        postId,
        limit: 10,
        cursor,
        shareToken,
        sharePassword,
      }).then(unwrapQueryResult);
      if (!active.current) {
        return;
      }
      setLoadedReplies((prev) => {
        const seen = new Set([...comment.replies, ...prev].map((reply) => reply.id));
        return [...prev, ...result.replies.filter((reply) => !seen.has(reply.id))];
      });
      setReplyCursor(result.nextCursor);
      setHasMoreReplies(result.hasMore);
    } catch {
      if (!active.current) {
        return;
      }
      notifications.show({ message: t('notifications.loadRepliesFailed'), tone: 'danger' });
    } finally {
      if (active.current) {
        repliesPending.current = false;
        setIsLoadingReplies(false);
      }
    }
  };

  const isEdited = new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 60000;

  return (
    <>
      <ConfirmationDialog
        intent="delete"
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
        title={t('deleteModal.title')}
        confirmLabel={tCommonActions('delete')}
        cancelLabel={tCommonActions('cancel')}
        closeLabel={tModalActions('close')}
        loading={deleteMutation.isPending}
        centered
        size="compact"
        message={
          <>
            <DsLayoutInline align="center" gap="md">
              <StatusIcon icon={IconAlertTriangle} tone="danger" size="md" />
              <DsText>{t('deleteModal.body')}</DsText>
            </DsLayoutInline>
          </>
        }
      />

      <DsSectionCard padding="none" appearance="plain" border="inline-start">
        <HierarchyIndent enabled={depth > 0}>
          <DsLayoutInset space="none">
            <SectionCard padding="sm" withBorder={depth === 0}>
              <DsLayoutStack gap="xs">
                <DsLayoutInline justify="between" align="start" wrap="nowrap">
                  <DsLayoutInline gap="sm" wrap="nowrap">
                    <Tooltip
                      label={
                        comment.isDeleted ? t('states.deletedUser') : comment.authorName || tCommonStates('anonymous')
                      }
                      withArrow
                    >
                      <Avatar
                        src={comment.isDeleted ? null : comment.authorImageUrl}
                        size="md"
                        shape="circle"
                        name={comment.isDeleted ? null : comment.authorName}
                      />
                    </Tooltip>
                    <DsLayoutStack gap="xxs">
                      <DsText size="sm" weight="strong" tone={comment.isDeleted ? 'secondary' : undefined}>
                        {comment.isDeleted ? t('states.deleted') : comment.authorName || tCommonStates('anonymous')}
                      </DsText>
                      <DsLayoutInline gap="xs">
                        <Tooltip label={dateTime.dateTime(comment.createdAt)} withArrow>
                          <div style={{ cursor: 'default' }}>
                            <DsText size="xs" tone="secondary">
                              {formatRelativeTime(comment.createdAt, locale, dateTime.timeZone)}
                            </DsText>
                          </div>
                        </Tooltip>
                        {isEdited && (
                          <Tooltip
                            label={t('editedTooltip', {
                              value: formatRelativeTime(comment.updatedAt, locale, dateTime.timeZone) ?? '',
                            })}
                            withArrow
                          >
                            <div style={{ cursor: 'default' }}>
                              <DsText size="xs" tone="secondary" italic>
                                {t('edited')}
                              </DsText>
                            </div>
                          </Tooltip>
                        )}
                      </DsLayoutInline>
                    </DsLayoutStack>
                  </DsLayoutInline>

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
                </DsLayoutInline>

                {isEditing ? (
                  <DsLayoutStack gap="xs">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      autosize
                      minRows={1}
                      maxRows={6}
                      autoFocus
                    />
                    <DsLayoutInline justify="end" gap="xs">
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
                      <SaveButton
                        type="button"
                        size="xs"
                        onClick={handleUpdate}
                        loading={updateMutation.isPending}
                        disabled={!editContent.trim()}
                      >
                        {tCommonActions('save')}
                      </SaveButton>
                    </DsLayoutInline>
                  </DsLayoutStack>
                ) : (
                  <DsText
                    size="sm"
                    wrap="preserve"
                    tone={comment.isDeleted ? 'secondary' : undefined}
                    italic={comment.isDeleted}
                  >
                    {comment.content}
                  </DsText>
                )}

                {!comment.isDeleted && (
                  <DsLayoutInline gap="xs">
                    {session?.user && canReply && depth < MAX_DEPTH && (
                      <Button
                        tone="neutral"
                        emphasis="low"
                        size="xs"
                        leftSection={<IconMessageReply size={14} />}
                        aria-expanded={replyOpened}
                        aria-controls={replyPanelId}
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
                        indicator="disclosure"
                        aria-expanded={repliesOpened}
                        aria-controls={repliesPanelId}
                        onClick={toggleReplies}
                      >
                        {t(repliesOpened ? 'actions.hideReplies' : 'actions.showReplies', {
                          count: displayedReplies.length,
                        })}
                        {remainingReplies > 0 ? ` ${t('actions.moreReplies', { count: remainingReplies })}` : ''}
                      </Button>
                    )}
                  </DsLayoutInline>
                )}

                <DisclosureRegion id={replyPanelId} expanded={replyOpened}>
                  <DsLayoutInset blockStart="xs">
                    <DsLayoutInset space="none">
                      <CommentForm
                        postId={postId}
                        parentId={comment.id}
                        placeholder={tForm('replyPlaceholder')}
                        autoFocus
                        onSuccess={closeReply}
                        onCancel={closeReply}
                      />
                    </DsLayoutInset>
                  </DsLayoutInset>
                </DisclosureRegion>
              </DsLayoutStack>
            </SectionCard>

            {displayedReplies.length > 0 && (
              <DisclosureRegion id={repliesPanelId} expanded={repliesOpened}>
                <DsLayoutInset blockStart="sm">
                  <DsLayoutStack gap="sm">
                    {displayedReplies.map((reply) => (
                      <CommentItem
                        key={reply.id}
                        comment={reply}
                        postId={postId}
                        shareToken={shareToken}
                        sharePassword={sharePassword}
                        depth={depth + 1}
                        canReply={canReply}
                        canModerate={canModerate}
                      />
                    ))}

                    {/* Load more replies button */}
                    {hasMoreReplies && remainingReplies > 0 && (
                      <HierarchyIndent enabled={depth > 0}>
                        <Button
                          tone="neutral"
                          emphasis="low"
                          size="xs"
                          loading={isLoadingReplies}
                          onClick={handleLoadMoreReplies}
                          disabled={isLoadingReplies}
                        >
                          {t('actions.loadMoreReplies', { count: remainingReplies })}
                        </Button>
                      </HierarchyIndent>
                    )}
                  </DsLayoutStack>
                </DsLayoutInset>
              </DisclosureRegion>
            )}
          </DsLayoutInset>
        </HierarchyIndent>
      </DsSectionCard>
    </>
  );
}
