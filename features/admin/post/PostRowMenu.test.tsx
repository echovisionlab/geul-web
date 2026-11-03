// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@/test/render';
import { PostRowMenu } from './PostRowMenu';
import { PostModalProvider } from './PostModalContext';

const actions = vi.hoisted(() => ({ refresh: vi.fn(), republish: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: actions.refresh }) }));
vi.mock('@/lib/actions/post', () => ({ republishPostAction: actions.republish }));

beforeEach(() => {
  actions.refresh.mockReset();
  actions.republish.mockReset().mockResolvedValue({ success: true });
});

function renderRow(status: string, slug?: string) {
  return render(
    <PostModalProvider>
      <PostRowMenu post={{ id: 'post-uuid', title: 'Post', slug, status }} />
    </PostModalProvider>,
  );
}

describe('PostRowMenu', () => {
  it.each(['published', 'archived'])('opens a %s post through its public route', async (status) => {
    const { user } = renderRow(status, 'field-notes');
    await user.click(screen.getByRole('button', { name: /Post/ }));
    expect(await screen.findByRole('menuitem', { name: 'View' })).toHaveAttribute('href', '/posts/field-notes');
  });

  it('republishes an archived post', async () => {
    const { user } = renderRow('archived');
    await user.click(screen.getByRole('button', { name: /Post/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Republish' }));
    expect(actions.republish).toHaveBeenCalledWith('post-uuid');
    await waitFor(() => expect(actions.refresh).toHaveBeenCalledOnce());
  });

  it('does not expose view or republish actions for a draft post', async () => {
    const { user } = renderRow('draft');
    await user.click(screen.getByRole('button', { name: /Post/ }));
    expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'View' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Republish' })).not.toBeInTheDocument();
  });
});

it('keeps the row trigger pending for the full republish promise', async () => {
  let finish!: (value: { success: boolean }) => void;
  actions.republish.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { user } = renderRow('archived');
  const trigger = screen.getByRole('button', { name: /Post/ });
  await user.click(trigger);
  await user.click(await screen.findByRole('menuitem', { name: 'Republish' }));
  expect(trigger).toHaveAttribute('aria-busy', 'true');
  expect(actions.refresh).not.toHaveBeenCalled();
  await act(async () => finish({ success: true }));
  await waitFor(() => expect(trigger).not.toHaveAttribute('aria-busy', 'true'));
  expect(actions.refresh).toHaveBeenCalledOnce();
});
