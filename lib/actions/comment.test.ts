import { create } from '@bufbuild/protobuf';
import { PostCommentNodeSchema } from '@echovisionlab/geul-proto/public/post_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listCommentsAction, loadMoreRepliesAction } from './comment';

const client = vi.hoisted(() => ({ listComments: vi.fn(), loadMoreCommentReplies: vi.fn() }));
const secureClient = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/server-client', () => ({
  createPublicPostClientWithAuth: async () => client,
  createCommentClient: secureClient,
}));

beforeEach(() => vi.clearAllMocks());

describe('public comment reads', () => {
  it('forwards the draft proof and pagination when reading a Post thread', async () => {
    client.listComments.mockResolvedValue({
      comments: [create(PostCommentNodeSchema, { id: 'comment-1', postId: 'post-1', content: 'Preview thread' })],
      hasMore: true,
      nextCursor: 'next-comment',
      totalCount: 21,
    });
    const result = await listCommentsAction('post-1', {
      cursor: 'previous-comment',
      shareToken: 'preview-token',
      sharePassword: 'preview-password',
    });
    expect(client.listComments).toHaveBeenCalledExactlyOnceWith({
      postId: 'post-1',
      limit: 20,
      replyLimit: 3,
      cursor: 'previous-comment',
      shareToken: 'preview-token',
      sharePassword: 'preview-password',
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        comments: [{ id: 'comment-1', content: 'Preview thread', replies: [] }],
        hasMore: true,
        nextCursor: 'next-comment',
        totalCount: 21,
      },
    });
    expect(secureClient).not.toHaveBeenCalled();
  });

  it('retains the owning Post and draft proof when loading more replies', async () => {
    client.loadMoreCommentReplies.mockResolvedValue({
      comments: [create(PostCommentNodeSchema, { id: 'reply-1', parentId: 'comment-1', postId: 'post-1' })],
      hasMore: false,
      totalCount: 1,
    });
    const result = await loadMoreRepliesAction('comment-1', {
      postId: 'post-1',
      cursor: 'previous-reply',
      shareToken: 'preview-token',
      sharePassword: 'preview-password',
    });
    expect(client.loadMoreCommentReplies).toHaveBeenCalledExactlyOnceWith({
      postId: 'post-1',
      commentId: 'comment-1',
      limit: 10,
      cursor: 'previous-reply',
      shareToken: 'preview-token',
      sharePassword: 'preview-password',
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        replies: [{ id: 'reply-1', parentId: 'comment-1' }],
        hasMore: false,
        totalCount: 1,
      },
    });
    expect(secureClient).not.toHaveBeenCalled();
  });
});
