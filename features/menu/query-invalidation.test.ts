import type { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { invalidateMenuEditorQueries } from './query-invalidation';

describe('invalidateMenuEditorQueries', () => {
  it('invalidates menu and translation queries after a menu item mutation', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    await invalidateMenuEditorQueries({ invalidateQueries } as unknown as QueryClient, 'menu-1');

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['menus'] });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['entity-translations', 'menu', 'menu-1'],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['entity-translation-jobs', 'menu', 'menu-1'],
    });
  });

  it('only invalidates menu queries when no menu is selected', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    await invalidateMenuEditorQueries({ invalidateQueries } as unknown as QueryClient, null);

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['menus'] });
  });
});
