import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Code, ConnectError } from '@connectrpc/connect';

const mocks = vi.hoisted(() => ({
  publicGet: vi.fn(),
  getLabelEditorData: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createPublicLabelClientWithAuth: vi.fn(async () => ({ get: mocks.publicGet })),
  createLabelClient: vi.fn(async () => ({
    getLabelEditorData: mocks.getLabelEditorData,
  })),
}));

import { getLabelForEdit } from './label';

describe('getLabelForEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.publicGet.mockResolvedValue({ label: { id: 'label-1', slug: 'label-slug' } });
    mocks.getLabelEditorData.mockResolvedValue({
      label: {
        id: 'label-1',
        name: 'Label',
        slug: 'label-slug',
        socialLinks: {},
        status: 'draft',
      },
      allowedActions: [],
    });
  });

  it('resolves UUID-or-slug and proves edit authority before returning manage data', async () => {
    await expect(getLabelForEdit('label-slug')).resolves.toMatchObject({
      id: 'label-1',
      slug: 'label-slug',
    });

    expect(mocks.publicGet).toHaveBeenCalledWith({ slug: 'label-slug' });
    expect(mocks.getLabelEditorData).toHaveBeenCalledWith({ id: 'label-1' });
  });

  it('returns null when the current Member lacks Label edit authority', async () => {
    mocks.getLabelEditorData.mockRejectedValue(new ConnectError('denied', Code.PermissionDenied));

    await expect(getLabelForEdit('label-slug')).resolves.toBeNull();
    expect(mocks.getLabelEditorData).toHaveBeenCalledWith({ id: 'label-1' });
  });

  it('returns null when the route does not resolve a Label', async () => {
    mocks.publicGet.mockResolvedValue({});

    await expect(getLabelForEdit('missing')).resolves.toBeNull();
    expect(mocks.getLabelEditorData).not.toHaveBeenCalled();
  });
});
