'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Stack, Text } from '@mantine/core';
import { TextInput } from '@/components/core/Input';
import { ConfirmModal, FormModal } from '@/components/core/Modal';
import { PageHeader } from '@/components/core/PageHeader';
import type { MapTheme } from '@/lib/types/map-theme/model';
import { MapThemeListView } from './MapThemeListView';

export interface MapThemeListPageViewProps {
  themes: MapTheme[];
  defaultMapThemeId: string;
  loadFailed?: boolean;
  copyLoading?: boolean;
  deleteLoading?: boolean;
  onCopy: (theme: MapTheme, name: string) => Promise<boolean>;
  onDelete: (theme: MapTheme) => Promise<boolean>;
  onSetDefault: (theme: MapTheme) => void;
  createAction: ReactNode;
}

export function MapThemeListPageView({
  themes,
  defaultMapThemeId,
  loadFailed = false,
  copyLoading = false,
  deleteLoading = false,
  onCopy,
  onDelete,
  onSetDefault,
  createAction,
}: MapThemeListPageViewProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const tPage = useTranslations('adminList.mapThemes');
  const [copyingTheme, setCopyingTheme] = useState<MapTheme | null>(null);
  const [copyName, setCopyName] = useState('');
  const [deletingTheme, setDeletingTheme] = useState<MapTheme | null>(null);

  const openCopy = (theme: MapTheme) => {
    setCopyingTheme(theme);
    setCopyName(tPage('defaults.copyName', { name: theme.name }));
  };

  const closeCopy = () => {
    if (copyLoading) {
      return;
    }
    setCopyingTheme(null);
    setCopyName('');
  };

  const submitCopy = async () => {
    if (!copyingTheme || !copyName.trim()) {
      return;
    }
    if (await onCopy(copyingTheme, copyName.trim())) {
      setCopyingTheme(null);
      setCopyName('');
    }
  };

  const closeDelete = () => {
    if (!deleteLoading) {
      setDeletingTheme(null);
    }
  };

  const confirmDelete = async () => {
    if (deletingTheme && (await onDelete(deletingTheme))) {
      setDeletingTheme(null);
    }
  };

  return (
    <Stack gap="md">
      <PageHeader title={tCommonEntities('mapThemes')} actions={createAction} />

      <MapThemeListView
        themes={themes}
        defaultMapThemeId={defaultMapThemeId}
        loadFailed={loadFailed}
        onCopy={openCopy}
        onDelete={setDeletingTheme}
        onSetDefault={onSetDefault}
      />

      <FormModal
        opened={Boolean(copyingTheme)}
        onClose={closeCopy}
        onSubmit={() => void submitCopy()}
        title={tPage('copyModal.title')}
        submitLabel={tCommon('actions.copy')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={copyLoading}
        submitDisabled={!copyName.trim()}
      >
        <Text>{tPage('copyModal.description', { name: copyingTheme?.name ?? '' })}</Text>
        <TextInput
          label={tPage('copyModal.nameLabel')}
          placeholder={tPage('copyModal.namePlaceholder')}
          value={copyName}
          onChange={(event) => setCopyName(event.currentTarget.value)}
          required
        />
      </FormModal>

      <ConfirmModal
        opened={Boolean(deletingTheme)}
        onClose={closeDelete}
        onConfirm={() => void confirmDelete()}
        title={tPage('deleteModal.title')}
        message={
          <>
            <Text>
              {tCommon.rich('messages.confirmDeleteNamedRich', {
                name: deletingTheme?.name ?? '',
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </Text>
            <Text size="sm" c="orange">
              {tPage('deleteModal.warning')}
            </Text>
          </>
        }
        confirmLabel={tCommon('actions.delete')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={deleteLoading}
      />
    </Stack>
  );
}
