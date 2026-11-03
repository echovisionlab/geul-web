// @vitest-environment jsdom
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PostStatus } from '@echovisionlab/geul-proto/public/post_pb.ts';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@/test/render';
import { Checkbox } from '@/components/core/Input';
import { CommentSection } from './CommentSection';
import type { CommentNode } from '@/lib/actions/comment';

vi.mock('@/lib/actions/comment', () => ({
  listCommentsAction: vi.fn(),
  createCommentAction: vi.fn(),
  loadMoreRepliesAction: vi.fn(),
  deleteCommentAction: vi.fn(),
  updateCommentAction: vi.fn(),
}));
vi.mock('@/lib/auth/client', () => ({ useSession: () => ({ data: null }) }));

describe('document comment setting', () => {
  it('does not request comments while disabled and restores the guest view when enabled', async () => {
    const listAction = vi.fn(async () => ({
      ok: true as const,
      value: { comments: [], totalCount: 0, hasMore: false },
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Preview() {
      const [enabled, setEnabled] = useState(false);
      return (
        <QueryClientProvider client={client}>
          <Checkbox
            id="allow-comments"
            label="Allow comments"
            checked={enabled}
            onChange={(event) => setEnabled(event.currentTarget.checked)}
          />
          <CommentSection
            postId="post-1"
            commentsEnabled={enabled}
            status={PostStatus.PUBLISHED}
            sessionSnapshot={null}
            listAction={listAction}
          />
        </QueryClientProvider>
      );
    }
    const { user } = render(<Preview />);
    expect(listAction).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Comments' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Allow comments' }));
    expect(await screen.findByRole('heading', { name: 'Comments' })).toBeVisible();
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
    expect(listAction).toHaveBeenCalledWith('post-1', {
      cursor: undefined,
      shareToken: undefined,
      sharePassword: undefined,
    });

    await user.click(screen.getByRole('checkbox', { name: 'Allow comments' }));
    expect(screen.queryByRole('heading', { name: 'Comments' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /log in/i })).not.toBeInTheDocument();
    client.clear();
  });
  it('keeps loaded comments visible when a continuation request fails', async () => {
    const comment: CommentNode = {
      id: 'comment-1',
      postId: 'post-1',
      content: 'First comment',
      isDeleted: false,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      authorName: 'Mina',
      replies: [],
      hasMoreReplies: false,
      totalReplyCount: 0,
    };
    let fail!: (error: Error) => void;
    const listAction = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        value: { comments: [comment], totalCount: 2, hasMore: true, nextCursor: 'second' },
      })
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            fail = reject;
          }),
      );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { user, unmount } = render(
      <QueryClientProvider client={client}>
        <CommentSection
          postId="post-1"
          commentsEnabled
          status={PostStatus.PUBLISHED}
          sessionSnapshot={null}
          listAction={listAction}
        />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('First comment')).toBeVisible();
    const more = screen.getByRole('button', { name: 'Load 1 more comment' });
    await user.click(more);
    expect(more).toHaveAttribute('aria-busy', 'true');
    await act(async () => fail(new Error('offline')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load comments.');
    expect(screen.getByText('First comment')).toBeVisible();
    expect(screen.getByRole('heading', { name: /Comments/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Load 1 more comment' })).toBeEnabled();
    unmount();
    client.clear();
  });
});
