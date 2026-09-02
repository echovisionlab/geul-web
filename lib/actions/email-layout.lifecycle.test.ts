import { revalidatePath } from 'next/cache';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmailLayoutClient } from '@/lib/api/server-client';
import { deleteEmailLayoutAction } from './email-layout';

const deleteEmailLayout = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createEmailLayoutClient: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createEmailLayoutClient).mockResolvedValue({ deleteEmailLayout } as never);
});

describe('email layout lifecycle actions', () => {
  it('deletes through the hard-cut RPC and invalidates composition surfaces', async () => {
    deleteEmailLayout.mockResolvedValue({ success: true });

    await expect(deleteEmailLayoutAction('layout-1')).resolves.toEqual({ success: true });

    expect(deleteEmailLayout).toHaveBeenCalledWith({ id: 'layout-1' });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/email-layouts');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/email-templates');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/campaigns');
  });

  it('preserves the server conflict boundary for referenced layouts', async () => {
    deleteEmailLayout.mockRejectedValue(new ConnectError('layout is in use', Code.FailedPrecondition));

    await expect(deleteEmailLayoutAction('layout-1')).resolves.toEqual({
      error: expect.stringContaining('layout is in use'),
      errorCode: 'FAILED_PRECONDITION',
    });
  });

  it('does not turn a committed delete into a client-visible failure when cache invalidation fails', async () => {
    deleteEmailLayout.mockResolvedValue({ success: true });
    vi.mocked(revalidatePath).mockImplementation(() => {
      throw new Error('cache unavailable');
    });

    await expect(deleteEmailLayoutAction('layout-1')).resolves.toEqual({ success: true });
    expect(deleteEmailLayout).toHaveBeenCalledWith({ id: 'layout-1' });
  });
});
