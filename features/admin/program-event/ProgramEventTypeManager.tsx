'use client';

import { useMemo, useState } from 'react';
import { IconListDetails } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Group, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Button } from '@/components/core/Button';
import { Checkbox, NumberInput, Select, Textarea, TextInput } from '@/components/core/Input';
import { ConfirmModal, ContentModal } from '@/components/core/Modal';
import {
  createProgramEventTypeAction,
  deleteProgramEventTypeAction,
  updateProgramEventTypeAction,
} from '@/lib/actions/program-event';
import { useLocale } from '@/lib/providers/LocaleProvider';
import type { AdminProgramEventTypeOption } from '@/lib/queries/program-event';

export interface ProgramEventTypeDraft {
  id: string | null;
  name: string;
  description: string;
  slug: string;
  status: 'active' | 'inactive';
  sortOrder: number;
  requiresPlace: boolean;
  requiresStreamUrl: boolean;
}

function draftFor(type: AdminProgramEventTypeOption | undefined, locale: string): ProgramEventTypeDraft {
  const localized = type?.locales.find((entry) => entry.locale === locale) ?? type?.locales[0];
  return {
    id: type?.id ?? null,
    name: localized?.name ?? '',
    description: localized?.description ?? '',
    slug: type?.slug ?? '',
    status: type?.status ?? 'active',
    sortOrder: type?.sortOrder ?? 0,
    requiresPlace: type?.requiresPlace ?? false,
    requiresStreamUrl: type?.requiresStreamUrl ?? false,
  };
}

export interface ProgramEventTypeManagerViewProps {
  opened: boolean;
  types: AdminProgramEventTypeOption[];
  draft: ProgramEventTypeDraft;
  saving?: boolean;
  deleting?: boolean;
  deleteConfirmationOpened?: boolean;
  labels: {
    title: string;
    close: string;
    type: string;
    newType: string;
    name: string;
    description: string;
    slug: string;
    status: string;
    active: string;
    inactive: string;
    sortOrder: string;
    requiresPlace: string;
    requiresStreamUrl: string;
    save: string;
    delete: string;
    cancel: string;
    deleteTitle: string;
    deleteMessage: string;
  };
  onClose: () => void;
  onSelect: (id: string | null) => void;
  onDraftChange: (draft: ProgramEventTypeDraft) => void;
  onSave: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

export function ProgramEventTypeManagerView({
  opened,
  types,
  draft,
  saving = false,
  deleting = false,
  deleteConfirmationOpened = false,
  labels,
  onClose,
  onSelect,
  onDraftChange,
  onSave,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: ProgramEventTypeManagerViewProps) {
  const selectedValue = draft.id ?? '$new';
  return (
    <>
      <ContentModal opened={opened} onClose={onClose} title={labels.title} closeLabel={labels.close} size="standard">
        <Stack gap="md">
          <Select
            label={labels.type}
            value={selectedValue}
            data={[
              { value: '$new', label: labels.newType },
              ...types.map((type) => ({ value: type.id, label: type.name })),
            ]}
            onChange={(value) => onSelect(value === '$new' ? null : value)}
            allowDeselect={false}
          />
          <TextInput
            label={labels.name}
            value={draft.name}
            onChange={(event) => onDraftChange({ ...draft, name: event.currentTarget.value })}
            required
          />
          <Textarea
            label={labels.description}
            value={draft.description}
            onChange={(event) => onDraftChange({ ...draft, description: event.currentTarget.value })}
            autosize
            minRows={2}
          />
          <TextInput
            label={labels.slug}
            value={draft.slug}
            onChange={(event) => onDraftChange({ ...draft, slug: event.currentTarget.value })}
            required
          />
          <Select
            label={labels.status}
            value={draft.status}
            data={[
              { value: 'active', label: labels.active },
              { value: 'inactive', label: labels.inactive },
            ]}
            onChange={(value) => onDraftChange({ ...draft, status: value === 'inactive' ? 'inactive' : 'active' })}
            allowDeselect={false}
            disabled={!draft.id}
          />
          <NumberInput
            label={labels.sortOrder}
            value={draft.sortOrder}
            onChange={(value) => onDraftChange({ ...draft, sortOrder: typeof value === 'number' ? value : 0 })}
          />
          <Checkbox
            label={labels.requiresPlace}
            checked={draft.requiresPlace}
            onChange={(event) => onDraftChange({ ...draft, requiresPlace: event.currentTarget.checked })}
          />
          <Checkbox
            label={labels.requiresStreamUrl}
            checked={draft.requiresStreamUrl}
            onChange={(event) => onDraftChange({ ...draft, requiresStreamUrl: event.currentTarget.checked })}
          />
          <Group justify="space-between">
            <Button type="button" tone="danger" emphasis="low" onClick={onRequestDelete} disabled={!draft.id || saving}>
              {labels.delete}
            </Button>
            <Group gap="xs">
              <Button type="button" tone="neutral" emphasis="low" onClick={onClose} disabled={saving}>
                {labels.cancel}
              </Button>
              <Button
                type="button"
                onClick={onSave}
                loading={saving}
                disabled={!draft.name.trim() || !draft.slug.trim()}
              >
                {labels.save}
              </Button>
            </Group>
          </Group>
        </Stack>
      </ContentModal>
      <ConfirmModal
        opened={deleteConfirmationOpened}
        onClose={onCancelDelete}
        onConfirm={onConfirmDelete}
        title={labels.deleteTitle}
        message={labels.deleteMessage}
        confirmLabel={labels.delete}
        cancelLabel={labels.cancel}
        closeLabel={labels.close}
        loading={deleting}
        centered
      />
    </>
  );
}

export function ProgramEventTypeManagerButton({ initialTypes }: { initialTypes: AdminProgramEventTypeOption[] }) {
  const locale = useLocale();
  const tCommon = useTranslations('common');
  const tTypes = useTranslations('programEventAdmin.types');
  const [opened, setOpened] = useState(false);
  const [types, setTypes] = useState(initialTypes);
  const [draft, setDraft] = useState<ProgramEventTypeDraft>(() => draftFor(initialTypes[0], locale));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmationOpened, setDeleteConfirmationOpened] = useState(false);
  const labels = useMemo(
    () => ({
      title: tTypes('title'),
      close: tCommon('actions.close'),
      type: tCommon('entities.programEventType'),
      newType: tCommon('actions.newItem', { item: tCommon('entities.programEventType') }),
      name: tCommon('labels.name'),
      description: tCommon('labels.description'),
      slug: tCommon('labels.slug'),
      status: tCommon('labels.status'),
      active: tCommon('statuses.active'),
      inactive: tCommon('statuses.inactive'),
      sortOrder: tTypes('sortOrder'),
      requiresPlace: tTypes('requiresPlace'),
      requiresStreamUrl: tTypes('requiresStreamUrl'),
      save: tCommon('actions.save'),
      delete: tCommon('actions.delete'),
      cancel: tCommon('actions.cancel'),
      deleteTitle: tTypes('deleteTitle'),
      deleteMessage: tTypes('deleteMessage'),
    }),
    [tCommon, tTypes],
  );

  const selectType = (id: string | null) =>
    setDraft(
      draftFor(
        types.find((type) => type.id === id),
        locale,
      ),
    );
  const save = async () => {
    setSaving(true);
    const result = draft.id
      ? await updateProgramEventTypeAction(draft.id, { ...draft, locale })
      : await createProgramEventTypeAction({
          name: draft.name,
          slug: draft.slug,
          sortOrder: draft.sortOrder,
          description: draft.description,
          requiresPlace: draft.requiresPlace,
          requiresStreamUrl: draft.requiresStreamUrl,
        });
    setSaving(false);
    if ('error' in result && result.error) {
      notifications.show({ message: result.error, color: 'red' });
      return;
    }
    if (!draft.id && 'data' in result && result.data) {
      const created: AdminProgramEventTypeOption = {
        id: result.data.id,
        slug: draft.slug,
        name: draft.name,
        status: 'active',
        sortOrder: draft.sortOrder,
        requiresPlace: draft.requiresPlace,
        requiresStreamUrl: draft.requiresStreamUrl,
        locales: [{ locale, name: draft.name, description: draft.description || null }],
      };
      setTypes((current) => [...current, created]);
      setDraft(draftFor(created, locale));
    } else {
      setTypes((current) =>
        current.map((type) =>
          type.id === draft.id
            ? {
                ...type,
                ...draft,
                id: type.id,
                locales: [
                  ...type.locales.filter((entry) => entry.locale !== locale),
                  { locale, name: draft.name, description: draft.description || null },
                ],
              }
            : type,
        ),
      );
    }
    notifications.show({ message: tCommon('notifications.saveSuccess'), color: 'green' });
  };
  const confirmDelete = async () => {
    if (!draft.id) {
      return;
    }
    setDeleting(true);
    const result = await deleteProgramEventTypeAction(draft.id);
    setDeleting(false);
    if ('error' in result && result.error) {
      notifications.show({ message: result.error, color: 'red' });
      return;
    }
    const remaining = types.filter((type) => type.id !== draft.id);
    setTypes(remaining);
    setDraft(draftFor(remaining[0], locale));
    setDeleteConfirmationOpened(false);
  };

  return (
    <>
      <Button leftSection={<IconListDetails size={16} />} tone="neutral" emphasis="low" onClick={() => setOpened(true)}>
        {tTypes('title')}
      </Button>
      <ProgramEventTypeManagerView
        opened={opened}
        types={types}
        draft={draft}
        saving={saving}
        deleting={deleting}
        deleteConfirmationOpened={deleteConfirmationOpened}
        labels={labels}
        onClose={() => setOpened(false)}
        onSelect={selectType}
        onDraftChange={setDraft}
        onSave={save}
        onRequestDelete={() => setDeleteConfirmationOpened(true)}
        onCancelDelete={() => setDeleteConfirmationOpened(false)}
        onConfirmDelete={confirmDelete}
      />
    </>
  );
}
