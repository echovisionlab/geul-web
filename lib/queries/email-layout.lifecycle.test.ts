import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmailLayoutClient } from '@/lib/api/browser-client';
import { listEmailLayouts, listEmailLayoutsSimple } from './email-layout';

const listEmailLayoutsAdmin = vi.fn();

vi.mock('@/lib/api/browser-client', () => ({
  createEmailLayoutClient: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createEmailLayoutClient).mockReturnValue({ listEmailLayoutsAdmin } as never);
});

describe('email layout lifecycle queries', () => {
  it('maps deletion blocker counts without archive visibility state', async () => {
    listEmailLayoutsAdmin.mockResolvedValue({
      layouts: [
        {
          id: 'layout-1',
          key: 'default',
          name: 'Default',
          htmlContent: '{{content}}',
          campaignCount: 2,
          templateCount: 4,
          deliveryRunCount: 8,
        },
      ],
      pagination: { total: 1 },
    });

    const result = await listEmailLayouts();

    expect(listEmailLayoutsAdmin).toHaveBeenCalledWith({
      pagination: { limit: 20, offset: 0 },
      filters: undefined,
      sorts: undefined,
    });
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        campaignCount: 2,
        templateCount: 4,
        deliveryRunCount: 8,
      }),
    );
    expect(result.data[0]).not.toHaveProperty('archivedAt');
  });

  it('does not turn authoring read failures into an empty catalog', async () => {
    const failure = new Error('authoring unavailable');
    listEmailLayoutsAdmin.mockRejectedValue(failure);

    await expect(listEmailLayouts()).rejects.toBe(failure);
    await expect(listEmailLayoutsSimple()).rejects.toBe(failure);
  });

  it('uses the same unarchived contract for composition pickers', async () => {
    listEmailLayoutsAdmin.mockResolvedValue({ layouts: [], pagination: { total: 0 } });

    await listEmailLayoutsSimple();

    expect(listEmailLayoutsAdmin).toHaveBeenCalledWith({
      pagination: { limit: 100, offset: 0 },
    });
  });

  it('loads every layout for composition pickers', async () => {
    listEmailLayoutsAdmin
      .mockResolvedValueOnce({
        layouts: Array.from({ length: 100 }, (_, index) => ({
          id: `layout-${index}`,
          key: `layout_${index}`,
          name: `Layout ${index}`,
        })),
        pagination: { total: 101 },
      })
      .mockResolvedValueOnce({
        layouts: [{ id: 'layout-100', key: 'layout_100', name: 'Layout 100' }],
        pagination: { total: 101 },
      });

    const layouts = await listEmailLayoutsSimple();

    expect(layouts).toHaveLength(101);
    expect(listEmailLayoutsAdmin).toHaveBeenNthCalledWith(2, {
      pagination: { limit: 100, offset: 100 },
    });
  });
});
