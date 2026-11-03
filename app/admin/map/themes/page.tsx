'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import { MapThemeListPageView } from '@/features/admin/MapThemeEditor/MapThemeListPageView';
import { CreateMapThemeButton } from '@/features/admin/MapThemeEditor/CreateMapThemeButton';
import { PageLoader } from '@/features/site/PageLoader';
import {
  copyMapThemeAction,
  deleteMapThemeAction,
  listMapThemesAction,
  setDefaultMapThemeAction,
} from '@/lib/actions/map-theme';
import type { MapTheme } from '@/lib/types/map-theme/model';

export default function AdminMapThemesPage() {
  const tPage = useTranslations('adminList.mapThemes');
  const queryClient = useQueryClient();
  const {
    data: themeList,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['mapThemes', 'list'],
    queryFn: listMapThemesAction,
  });

  const copyTheme = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => copyMapThemeAction(id, name),
  });
  const deleteTheme = useMutation({ mutationFn: (id: string) => deleteMapThemeAction(id) });
  const setDefaultTheme = useMutation({ mutationFn: (id: string) => setDefaultMapThemeAction(id) });

  const handleCopy = async (theme: MapTheme, name: string): Promise<boolean> => {
    try {
      const result = await copyTheme.mutateAsync({ id: theme.id, name });
      if (result.error) {
        notifications.show({ message: tPage('notifications.copyFailed'), tone: 'danger' });
        return false;
      }
      notifications.show({ message: tPage('notifications.copied'), tone: 'positive' });
      await queryClient.invalidateQueries({ queryKey: ['mapThemes'] });
      return true;
    } catch {
      notifications.show({ message: tPage('notifications.copyFailed'), tone: 'danger' });
      return false;
    }
  };

  const handleDelete = async (theme: MapTheme): Promise<boolean> => {
    try {
      const result = await deleteTheme.mutateAsync(theme.id);
      if (result.error) {
        notifications.show({ message: tPage('notifications.deleteFailed'), tone: 'danger' });
        return false;
      }
      notifications.show({ message: tPage('notifications.deleted'), tone: 'positive' });
      await queryClient.invalidateQueries({ queryKey: ['mapThemes'] });
      return true;
    } catch {
      notifications.show({ message: tPage('notifications.deleteFailed'), tone: 'danger' });
      return false;
    }
  };

  const handleSetDefault = async (theme: MapTheme): Promise<void> => {
    if (theme.id === themeList?.defaultMapThemeId) {
      return;
    }

    try {
      const result = await setDefaultTheme.mutateAsync(theme.id);
      if (result.error) {
        notifications.show({ message: tPage('notifications.defaultUpdateFailed'), tone: 'danger' });
        return;
      }
      notifications.show({ message: tPage('notifications.defaultUpdated'), tone: 'positive' });
      await queryClient.invalidateQueries({ queryKey: ['mapThemes'] });
    } catch {
      notifications.show({ message: tPage('notifications.defaultUpdateFailed'), tone: 'danger' });
    }
  };

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <MapThemeListPageView
      themes={themeList?.themes ?? []}
      defaultMapThemeId={themeList?.defaultMapThemeId ?? ''}
      defaultUpdatingId={setDefaultTheme.isPending ? (setDefaultTheme.variables ?? null) : null}
      loadFailed={isError}
      copyLoading={copyTheme.isPending}
      deleteLoading={deleteTheme.isPending}
      onCopy={handleCopy}
      onDelete={handleDelete}
      onSetDefault={(theme) => void handleSetDefault(theme)}
      createAction={<CreateMapThemeButton />}
    />
  );
}
