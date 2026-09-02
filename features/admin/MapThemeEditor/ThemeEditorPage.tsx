'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Divider, useComputedColorScheme } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Alert } from '@/components/core/Alert';
import { EditorHeader, type StatusOption } from '@/features/editor/EditorHeader';
import { PageLoader } from '@/features/site/PageLoader';
import { listMapThemesAction, setDefaultMapThemeAction } from '@/lib/actions/map-theme';
import { useMapThemeEditorCollaboration } from '@/lib/hooks/useMapThemeEditorCollaboration';
import type { MapTheme, ThemeSettings, ThemeVariant } from '@/lib/types/map-theme/model';
import { MapThemeEditorInterruptionDialogs } from './MapThemeEditorInterruptionDialogs';
import { MapThemeVariantTabs, type MapThemeVariantTab } from './MapThemeVariantTabs';
import { ThemeEditorCanvas } from './ThemeEditorCanvas';
import { useMapThemeEditorInterruption } from './useMapThemeEditorInterruption';

interface ThemeEditorPageProps {
  themeId: string;
  initialTheme: MapTheme;
}

type MapThemeHeaderStatus = 'custom' | 'default';

export function ThemeEditorPage({ themeId, initialTheme }: ThemeEditorPageProps) {
  const t = useTranslations('adminList.mapThemes.editor');
  const tPage = useTranslations('adminList.mapThemes');
  const tCommonActions = useTranslations('common.actions');
  const tCommonStatuses = useTranslations('common.statuses');
  const router = useRouter();
  const queryClient = useQueryClient();
  const colorScheme = useComputedColorScheme('light');

  const theme = initialTheme;
  const {
    data: themeList,
    isLoading: isThemeListLoading,
    isError: isThemeListError,
  } = useQuery({
    queryKey: ['mapThemes', 'list'],
    queryFn: listMapThemesAction,
  });

  const initialState = useMemo(() => {
    if (!theme) {
      return undefined;
    }

    return {
      name: theme.name,
      settings: theme.settings,
      lightVariant: omitId(theme.lightVariant),
      darkVariant: omitId(theme.darkVariant),
    };
  }, [theme]);

  const {
    provider,
    isConnected,
    isSynced,
    name,
    settings,
    lightVariant,
    darkVariant,
    setName,
    updateSettings,
    updateLightVariant,
    updateDarkVariant,
  } = useMapThemeEditorCollaboration(themeId, initialState);
  const { blocked, interruption, reloadRequired } = useMapThemeEditorInterruption(provider, themeId);

  const [activeTab, setActiveTab] = useState<MapThemeVariantTab>('light');
  const isDefault = themeList?.defaultMapThemeId === themeId;
  const canMutate = isConnected && isSynced && !blocked;

  useEffect(() => {
    if (!theme) {
      return;
    }

    setActiveTab(colorScheme);
  }, [colorScheme, theme]);

  const setDefaultTheme = useMutation({
    mutationFn: () => setDefaultMapThemeAction(themeId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: tPage('notifications.defaultUpdateFailed'), color: 'red' });
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['mapThemes', 'list'] });
      notifications.show({ message: t('notifications.defaultSet'), color: 'green' });
    },
    onError: () => {
      notifications.show({ message: tPage('notifications.defaultUpdateFailed'), color: 'red' });
    },
  });

  const handleBack = useCallback(() => {
    router.push('/admin/map/themes');
  }, [router]);

  const handleStatusChange = useCallback(
    (nextStatus: MapThemeHeaderStatus) => {
      if (canMutate && nextStatus === 'default' && !isDefault) {
        setDefaultTheme.mutate();
      }
    },
    [canMutate, isDefault, setDefaultTheme],
  );

  const handleSettingsChange = useCallback(
    (nextSettings: ThemeSettings) => {
      if (!canMutate) {
        return;
      }
      const changed = diffFields(settings, nextSettings);
      updateSettings(changed);
    },
    [canMutate, settings, updateSettings],
  );

  const handleVariantChange = useCallback(
    (nextVariant: Omit<ThemeVariant, 'id'>) => {
      if (!canMutate) {
        return;
      }
      if (activeTab === 'dark') {
        updateDarkVariant(diffFields(stripScheme(darkVariant), stripScheme(nextVariant)));
        return;
      }

      updateLightVariant(diffFields(stripScheme(lightVariant), stripScheme(nextVariant)));
    },
    [activeTab, canMutate, darkVariant, lightVariant, updateDarkVariant, updateLightVariant],
  );

  const headerStatus = isDefault ? 'default' : 'custom';
  const headerStatusOptions = useMemo<StatusOption<MapThemeHeaderStatus>[]>(() => {
    if (isDefault) {
      return [
        {
          value: 'default',
          label: tCommonStatuses('default'),
          actionLabel: tCommonStatuses('default'),
          tone: 'accent',
        },
      ];
    }
    return [
      {
        value: 'custom',
        label: tCommonStatuses('custom'),
        actionLabel: tCommonStatuses('custom'),
        tone: 'neutral',
      },
      {
        value: 'default',
        label: tCommonStatuses('default'),
        actionLabel: tCommonActions('setAsDefault'),
        tone: 'accent',
      },
    ];
  }, [isDefault, tCommonActions, tCommonStatuses]);

  const currentVariant = activeTab === 'dark' ? darkVariant : lightVariant;

  if (isThemeListLoading) {
    return <PageLoader />;
  }

  if (isThemeListError) {
    return (
      <Alert role="alert" tone="danger">
        {tPage('loadFailed')}
      </Alert>
    );
  }

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100dvh - 2rem)',
        background: 'var(--mantine-color-body)',
      }}
    >
      <Box px="md" py="xs">
        <EditorHeader
          title={name}
          onTitleChange={canMutate ? setName : undefined}
          status={headerStatus}
          statusOptions={headerStatusOptions}
          isConnected={isConnected}
          isSynced={isSynced}
          onBack={handleBack}
          onStatusChange={canMutate && !isDefault ? handleStatusChange : undefined}
          isStatusChanging={setDefaultTheme.isPending}
          backTooltip={tCommonActions('back')}
        />
      </Box>

      <Divider />

      <Box px="md" py="xs">
        <MapThemeVariantTabs value={activeTab} onChange={setActiveTab} disabled={blocked} />
      </Box>

      <Divider />

      <Box style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <ThemeEditorCanvas
          variant={currentVariant}
          settings={settings}
          showControls={canMutate}
          onVariantChange={handleVariantChange}
          onSettingsChange={handleSettingsChange}
        />
      </Box>
      <MapThemeEditorInterruptionDialogs interruption={interruption} reloadRequired={reloadRequired} />
    </Box>
  );
}

function omitId(variant: ThemeVariant): Omit<ThemeVariant, 'id'> {
  const { id: _, ...rest } = variant;
  return rest;
}

function stripScheme(variant: Omit<ThemeVariant, 'id'>): Omit<Omit<ThemeVariant, 'id'>, 'scheme'> {
  const { scheme: _, ...rest } = variant;
  return rest;
}

function diffFields<T extends object>(previous: T, next: T): Partial<T> {
  const changed: Partial<T> = {};

  (Object.keys(next as object) as Array<keyof T>).forEach((key) => {
    if (!fieldEquals(previous[key], next[key])) {
      changed[key] = next[key];
    }
  });

  return changed;
}

function fieldEquals(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return false;
}
