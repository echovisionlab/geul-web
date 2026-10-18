// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationRegion, notifications } from '@/components/core/Notification';
import { render, screen, waitFor, within } from '@/test/render';
import { SubmissionDeleteButton } from './SubmissionDeleteButton';

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

function renderButton(deleteAction: (submissionId: string) => Promise<{ error?: string }>) {
  const onDeleted = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <SubmissionDeleteButton
        submissionId="submission-7"
        formId="form-1"
        deleteAction={deleteAction as never}
        onDeleted={onDeleted}
      />
      <NotificationRegion closeLabel="Close" />
    </QueryClientProvider>,
  );
  return { ...view, onDeleted };
}

afterEach(() => {
  notifications.clean();
});

// docs/design-system/confirmation-contract.md: deleting a submission waits for an explicit confirmation.
describe('SubmissionDeleteButton', () => {
  it('deletes only after confirmation and leaves the submission alone when cancelled', async () => {
    const deleteAction = vi.fn(async () => ({}));
    const { user, onDeleted } = renderButton(deleteAction);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete Submission' });
    expect(deleteAction).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(deleteAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const reopened = await screen.findByRole('dialog', { name: 'Delete Submission' });
    await user.click(within(reopened).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(deleteAction).toHaveBeenCalledTimes(1);
    expect(deleteAction).toHaveBeenCalledWith('submission-7');
  });

  it('keeps the confirmation open and shows the error when deletion fails', async () => {
    const deleteAction = vi.fn(async () => ({ error: 'Submission is locked' }));
    const { user, onDeleted } = renderButton(deleteAction);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete Submission' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Submission is locked')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Delete Submission' })).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
