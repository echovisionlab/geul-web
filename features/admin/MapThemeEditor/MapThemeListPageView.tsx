'use client';
import { ConfirmationDialog } from '@/features/confirmation';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { TextInput } from '@/components/core/Input';
import { FormModal } from '@/components/core/Modal';
import { PageHeader } from '@/components/core/PageHeader';
import type { MapTheme } from '@/lib/types/map-theme/model';
import { MapThemeListView } from './MapThemeListView';

export interface MapThemeListPageViewProps {
  themes: MapTheme[];
  defaultMapThemeId: string;
  defaultUpdatingId: string | null;
  loadFailed?: boolean;
  copyLoading?: boolean;
  deleteLoading?: boolean;
  onCopy: (theme: MapTheme, name: string) => Promise<boolean>;
  onDelete: (theme: MapTheme) => Promise<boolean>;
  onSetDefault: (theme: MapTheme) => void | Promise<void>;
  createAction: ReactNode;
}

export function MapThemeListPageView({
  themes,
  defaultMapThemeId,
  defaultUpdatingId,
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
    <DsLayoutStack gap="md">
      <PageHeader title={tCommonEntities('mapThemes')} actions={createAction} />

      <MapThemeListView
        themes={themes}
        defaultMapThemeId={defaultMapThemeId}
        defaultUpdatingId={defaultUpdatingId}
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
        <DsText>{tPage('copyModal.description', { name: copyingTheme?.name ?? '' })}</DsText>
        <TextInput
          label={tPage('copyModal.nameLabel')}
          placeholder={tPage('copyModal.namePlaceholder')}
          value={copyName}
          onChange={(event) => setCopyName(event.currentTarget.value)}
          required
        />
      </FormModal>

      <ConfirmationDialog
        intent="delete"
        opened={Boolean(deletingTheme)}
        onClose={closeDelete}
        onConfirm={() => void confirmDelete()}
        title={tPage('deleteModal.title')}
        message={
          <>
            <DsText>
              {tCommon.rich('messages.confirmDeleteNamedRich', {
                name: deletingTheme?.name ?? '',
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </DsText>
            <DsText size="sm" tone="warning">
              {tPage('deleteModal.warning')}
            </DsText>
          </>
        }
        confirmLabel={tCommon('actions.delete')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={deleteLoading}
      />
    </DsLayoutStack>
  );
}
