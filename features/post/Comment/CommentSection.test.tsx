// @vitest-environment jsdom
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PostStatus } from '@echovisionlab/geul-proto/public/post_pb.ts';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { Checkbox } from '@/components/core/Input';
import { CommentSection } from './CommentSection';

vi.mock('@/lib/actions/comment', () => ({ listCommentsAction: vi.fn() }));

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
});
