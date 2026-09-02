'use server';

import { isConnectError, isConnectErrorCode } from '@/lib/api/connect-error';
import { timestampDate, type Timestamp } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import type { MemberSummary } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { createCommentClient } from '@/lib/api/server-client';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('comment-actions');

export interface CommentNode {
  id: string;
  postId: string;
  memberId?: string;
  parentId?: string;
  content: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorName?: string;
  authorImageUrl?: string;
  replies: CommentNode[];
  // Pagination for replies (Reddit-style)
  hasMoreReplies: boolean;
  totalReplyCount: number;
}

export interface CommentWithAuthor {
  id: string;
  postId: string;
  memberId?: string;
  parentId?: string;
  content: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorName?: string;
  authorImageUrl?: string;
}

export interface ListCommentsResult {
  comments: CommentNode[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount: number;
}

export interface LoadMoreRepliesResult {
  replies: CommentNode[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount: number;
}

function mapCommentNode(node: {
  id: string;
  postId: string;
  memberId?: string;
  parentId?: string;
  content: string;
  isDeleted: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  author?: MemberSummary;
  replies: unknown[];
  hasMoreReplies?: boolean;
  totalReplyCount?: number;
}): CommentNode {
  return {
    id: node.id,
    postId: node.postId,
    memberId: node.memberId,
    parentId: node.parentId,
    content: node.content,
    isDeleted: node.isDeleted,
    createdAt: node.createdAt ? timestampDate(node.createdAt) : new Date(),
    updatedAt: node.updatedAt ? timestampDate(node.updatedAt) : new Date(),
    authorName: node.author?.nickname,
    authorImageUrl: node.author?.avatarAsset?.url,
    replies: (node.replies as (typeof node)[]).map(mapCommentNode),
    hasMoreReplies: node.hasMoreReplies ?? false,
    totalReplyCount: node.totalReplyCount ?? 0,
  };
}

function mapCommentWithAuthor(c: {
  id: string;
  postId: string;
  memberId?: string;
  parentId?: string;
  content: string;
  isDeleted: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  author?: MemberSummary;
}): CommentWithAuthor {
  return {
    id: c.id,
    postId: c.postId,
    memberId: c.memberId,
    parentId: c.parentId,
    content: c.content,
    isDeleted: c.isDeleted,
    createdAt: c.createdAt ? timestampDate(c.createdAt) : new Date(),
    updatedAt: c.updatedAt ? timestampDate(c.updatedAt) : new Date(),
    authorName: c.author?.nickname,
    authorImageUrl: c.author?.avatarAsset?.url,
  };
}

export async function listCommentsAction(
  postId: string,
  options?: { limit?: number; cursor?: string; replyLimit?: number },
): Promise<ListCommentsResult> {
  try {
    const client = await createCommentClient();
    const response = await client.listCommentsByPost({
      postId,
      limit: options?.limit ?? 20,
      cursor: options?.cursor,
      replyLimit: options?.replyLimit ?? 3,
    });
    return {
      comments: (response.comments ?? []).map(mapCommentNode),
      nextCursor: response.nextCursor,
      hasMore: response.hasMore,
      totalCount: response.totalCount,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { comments: [], hasMore: false, totalCount: 0 };
    }
    logger.error('Failed to list comments', { error: err });
    return { comments: [], hasMore: false, totalCount: 0 };
  }
}

export async function loadMoreRepliesAction(
  commentId: string,
  options?: { limit?: number; cursor?: string },
): Promise<LoadMoreRepliesResult> {
  try {
    const client = await createCommentClient();
    const response = await client.loadMoreReplies({
      commentId,
      limit: options?.limit ?? 10,
      cursor: options?.cursor,
    });
    return {
      replies: (response.replies ?? []).map(mapCommentNode),
      nextCursor: response.nextCursor,
      hasMore: response.hasMore,
      totalCount: response.totalCount,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { replies: [], hasMore: false, totalCount: 0 };
    }
    logger.error('Failed to load more replies', { error: err });
    return { replies: [], hasMore: false, totalCount: 0 };
  }
}

export async function createCommentAction(
  postId: string,
  content: string,
  parentId?: string,
): Promise<{ comment?: CommentWithAuthor; error?: string }> {
  try {
    const client = await createCommentClient();
    const response = await client.createComment({
      postId,
      content,
      parentId: parentId || undefined,
    });
    if (!response.comment) {
      return { error: 'Failed to create comment' };
    }
    return { comment: mapCommentWithAuthor(response.comment) };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Please log in to comment' };
      }
      if (err.code === Code.FailedPrecondition) {
        return { error: err.message };
      }
    }
    logger.error('Failed to create comment', { error: err });
    return { error: err instanceof Error ? err.message : 'Failed to create comment' };
  }
}

export async function updateCommentAction(
  commentId: string,
  content: string,
): Promise<{ comment?: CommentWithAuthor; error?: string }> {
  try {
    const client = await createCommentClient();
    const response = await client.updateComment({ id: commentId, content });
    if (!response.comment) {
      return { error: 'Failed to update comment' };
    }
    return { comment: mapCommentWithAuthor(response.comment) };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Please log in' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'You do not have permission to edit this comment' };
      }
      if (err.code === Code.NotFound) {
        return { error: 'Comment not found' };
      }
    }
    logger.error('Failed to update comment', { error: err });
    return { error: err instanceof Error ? err.message : 'Failed to update comment' };
  }
}

export async function deleteCommentAction(commentId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createCommentClient();
    const response = await client.deleteComment({ id: commentId });
    return { success: response.success };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Please log in' };
      }
      if (err.code === Code.PermissionDenied) {
        return { error: 'You do not have permission to delete this comment' };
      }
      if (err.code === Code.NotFound) {
        return { error: 'Comment not found' };
      }
    }
    logger.error('Failed to delete comment', { error: err });
    return { error: err instanceof Error ? err.message : 'Failed to delete comment' };
  }
}
