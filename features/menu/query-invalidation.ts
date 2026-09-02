import type { QueryClient } from '@tanstack/react-query';

export async function invalidateMenuEditorQueries(queryClient: QueryClient, menuId?: string | null) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['menus'] }),
    menuId ? queryClient.invalidateQueries({ queryKey: ['entity-translations', 'menu', menuId] }) : Promise.resolve(),
    menuId
      ? queryClient.invalidateQueries({ queryKey: ['entity-translation-jobs', 'menu', menuId] })
      : Promise.resolve(),
  ]);
}
