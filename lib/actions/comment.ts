'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { runAction } from '@/lib/actions/run-action';
import { queryResult, type QueryResult } from '@/lib/api/query-result';

import { timestampDate, type Timestamp } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import type { MemberSummary } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { createPublicPostClientWithAuth, createCommentClient } from '@/lib/api/server-client';

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

export interface CommentReadAccess {
  shareToken?: string;
  sharePassword?: string;
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
  options?: { limit?: number; cursor?: string; replyLimit?: number } & CommentReadAccess,
): Promise<QueryResult<ListCommentsResult>> {
  return queryResult(async () => {
    const client = await createPublicPostClientWithAuth();
    const response = await client.listComments({
      postId,
      limit: options?.limit ?? 20,
      cursor: options?.cursor,
      replyLimit: options?.replyLimit ?? 3,
      shareToken: options?.shareToken,
      sharePassword: options?.sharePassword,
    });
    return {
      comments: (response.comments ?? []).map(mapCommentNode),
      nextCursor: response.nextCursor,
      hasMore: response.hasMore,
      totalCount: response.totalCount,
    };
  }, [options?.shareToken, options?.sharePassword]);
}

export async function loadMoreRepliesAction(
  commentId: string,
  options: { postId: string; limit?: number; cursor?: string } & CommentReadAccess,
): Promise<QueryResult<LoadMoreRepliesResult>> {
  return queryResult(async () => {
    const client = await createPublicPostClientWithAuth();
    const response = await client.loadMoreCommentReplies({
      postId: options.postId,
      shareToken: options.shareToken,
      sharePassword: options.sharePassword,
      commentId,
      limit: options.limit ?? 10,
      cursor: options.cursor,
    });
    return {
      replies: (response.comments ?? []).map(mapCommentNode),
      nextCursor: response.nextCursor,
      hasMore: response.hasMore,
      totalCount: response.totalCount,
    };
  }, [options.shareToken, options.sharePassword]);
}

export async function createCommentAction(
  postId: string,
  content: string,
  parentId?: string,
): Promise<ActionResult<{ comment: CommentWithAuthor }>> {
  return runAction(
    'comment',
    'createCommentAction',
    async () => {
      const client = await createCommentClient();
      const response = await client.createComment({
        postId,
        content,
        parentId: parentId || undefined,
      });
      if (!response.comment) {
        throw new Error('Failed to create comment');
      }
      return { comment: mapCommentWithAuthor(response.comment) };
    },
    { fallback: 'Failed to create comment', messages: { [Code.Unauthenticated]: 'Please log in to comment' } },
  );
}

export async function updateCommentAction(
  commentId: string,
  content: string,
): Promise<ActionResult<{ comment: CommentWithAuthor }>> {
  return runAction(
    'comment',
    'updateCommentAction',
    async () => {
      const client = await createCommentClient();
      const response = await client.updateComment({ id: commentId, content });
      if (!response.comment) {
        throw new Error('Failed to update comment');
      }
      return { comment: mapCommentWithAuthor(response.comment) };
    },
    {
      fallback: 'Failed to update comment',
      messages: {
        [Code.Unauthenticated]: 'Please log in',
        [Code.PermissionDenied]: 'You do not have permission to edit this comment',
        [Code.NotFound]: 'Comment not found',
      },
    },
  );
}

export async function deleteCommentAction(commentId: string): Promise<ActionResult<{ success: boolean }>> {
  return runAction(
    'comment',
    'deleteCommentAction',
    async () => {
      const client = await createCommentClient();
      const response = await client.deleteComment({ id: commentId });
      return { success: response.success };
    },
    {
      fallback: 'Failed to delete comment',
      messages: {
        [Code.Unauthenticated]: 'Please log in',
        [Code.PermissionDenied]: 'You do not have permission to delete this comment',
        [Code.NotFound]: 'Comment not found',
      },
    },
  );
}
