import { revalidatePath } from 'next/cache';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmailTemplateClient } from '@/lib/api/server-client';
import {
  deleteEmailTemplateAction,
  listEmailEventMappingsAction,
  listEmailTemplatesAdminAction,
} from './email-template';

const listEmailTemplatesAdmin = vi.fn();
const getEventMappings = vi.fn();
const deleteEmailTemplate = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createEmailTemplateClient: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createEmailTemplateClient).mockResolvedValue({
    listEmailTemplatesAdmin,
    getEventMappings,
    deleteEmailTemplate,
  } as never);
});

describe('email template lifecycle actions', () => {
  it('maps deletion blocker counts without archive visibility state', async () => {
    listEmailTemplatesAdmin.mockResolvedValue({
      templates: [
        {
          id: 'template-1',
          key: 'welcome',
          name: 'Welcome',
          subject: 'Welcome',
          isSystem: true,
          isActive: true,
          deliveryRunCount: 7,
        },
      ],
      pagination: { total: 1 },
    });

    const result = await listEmailTemplatesAdminAction({ page: 2, pageSize: 10 });

    expect(listEmailTemplatesAdmin).toHaveBeenCalledWith({
      pagination: { limit: 10, offset: 10 },
      filters: undefined,
      sorts: undefined,
    });
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'template-1',
        deliveryRunCount: 7,
      }),
    );
    expect(result.data[0]).not.toHaveProperty('archivedAt');
  });

  it('does not turn authoring read failures into an empty catalog', async () => {
    const failure = new Error('authoring unavailable');
    listEmailTemplatesAdmin.mockRejectedValueOnce(failure);
    getEventMappings.mockRejectedValueOnce(failure);

    await expect(listEmailTemplatesAdminAction({ page: 1, pageSize: 20 })).rejects.toBe(failure);
    await expect(listEmailEventMappingsAction()).rejects.toBe(failure);
  });

  it('deletes through the hard-cut RPC and invalidates every composition surface', async () => {
    deleteEmailTemplate.mockResolvedValue({ success: true });

    await expect(deleteEmailTemplateAction('template-1')).resolves.toEqual({ success: true });

    expect(deleteEmailTemplate).toHaveBeenCalledWith({ id: 'template-1' });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/email-templates');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/campaigns');
  });

  it('preserves the server conflict boundary for referenced templates', async () => {
    deleteEmailTemplate.mockRejectedValue(new ConnectError('template is in use', Code.FailedPrecondition));

    await expect(deleteEmailTemplateAction('template-1')).resolves.toEqual({
      error: expect.stringContaining('template is in use'),
      errorCode: 'FAILED_PRECONDITION',
    });
  });

  it('does not turn a committed delete into a client-visible failure when cache invalidation fails', async () => {
    deleteEmailTemplate.mockResolvedValue({ success: true });
    vi.mocked(revalidatePath).mockImplementation(() => {
      throw new Error('cache unavailable');
    });

    await expect(deleteEmailTemplateAction('template-1')).resolves.toEqual({ success: true });
    expect(deleteEmailTemplate).toHaveBeenCalledWith({ id: 'template-1' });
  });
});
