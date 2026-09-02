import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMenuClient } from '@/lib/api/browser-client';
import { listMenus } from './menu-browser';

const listMenusMock = vi.fn();

vi.mock('@/lib/api/browser-client', () => ({ createMenuClient: vi.fn() }));

function menu(id: string) {
  return { id, name: id, items: [] };
}

describe('listMenus', () => {
  beforeEach(() => {
    listMenusMock.mockReset();
    vi.mocked(createMenuClient).mockReturnValue({ listMenus: listMenusMock } as never);
  });

  it('returns every Menu across API pages', async () => {
    listMenusMock
      .mockResolvedValueOnce({
        menus: Array.from({ length: 100 }, (_, index) => menu(`menu-${index + 1}`)),
        pagination: { hasMore: true },
      })
      .mockResolvedValueOnce({ menus: [menu('menu-101')], pagination: { hasMore: false } });

    const result = await listMenus();

    expect(result).toHaveLength(101);
    expect(result.at(-1)?.id).toBe('menu-101');
    expect(listMenusMock).toHaveBeenNthCalledWith(1, { pagination: { limit: 100, offset: 0 } });
    expect(listMenusMock).toHaveBeenNthCalledWith(2, { pagination: { limit: 100, offset: 100 } });
  });
});
