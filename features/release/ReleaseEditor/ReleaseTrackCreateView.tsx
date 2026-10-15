'use client';
import { useReleaseEditorCanEdit } from './ReleaseEditorAccessContext';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { ContentModal, DialogActions } from '@/components/core/Modal';
import { TimePicker, TextInput } from '@/components/core/Input';
import { Button } from '@/components/core/Button';

interface ReleaseTrackCreateViewProps {
  idPrefix?: string;
  opened: boolean;
  title: string;
  durationSeconds: number | '';
  isCreating?: boolean;
  onOpen: () => void;
  onClose: () => void;
  onTitleChange: (value: string) => void;
  onDurationChange: (value: number | '') => void;
  onSubmit: () => void;
}

export function ReleaseTrackCreateView({
  idPrefix,
  opened,
  title,
  durationSeconds,
  isCreating = false,
  onOpen,
  onClose,
  onTitleChange,
  onDurationChange,
  onSubmit,
}: ReleaseTrackCreateViewProps) {
  const tModalActions = useTranslations('common.actions');
  const canEdit = useReleaseEditorCanEdit();
  const tCommon = useTranslations('common');
  const t = useTranslations('releaseEditor.tracks');

  return (
    <>
      <Button
        id={idPrefix ? `${idPrefix}-add-button` : 'release-track-add-button'}
        emphasis="medium"
        size="xs"
        leftSection={<IconPlus size={14} />}
        disabled={!canEdit}
        onClick={onOpen}
      >
        {tCommon('actions.addItem', { item: tCommon('entities.track') })}
      </Button>

      <ContentModal opened={opened} onClose={onClose} title={t('addModal.title')} closeLabel={tModalActions('close')}>
        <DsLayoutStack>
          <TextInput
            disabled={!canEdit}
            id={idPrefix ? `${idPrefix}-title-input` : 'release-track-add-title-input'}
            label={tCommon('labels.title')}
            placeholder={t('placeholders.title')}
            value={title}
            onChange={(event) => onTitleChange(event.currentTarget.value)}
            required
          />
          <TimePicker
            disabled={!canEdit}
            id={idPrefix ? `${idPrefix}-duration` : undefined}
            label={tCommon('labels.length')}
            value={secondsToTimePickerValue(durationSeconds)}
            onChange={(value) => onDurationChange(timePickerValueToSeconds(value))}
            clearable
            withSeconds
            hoursInputLabel={tCommon('labels.hours')}
            minutesInputLabel={tCommon('labels.minutes')}
            secondsInputLabel={tCommon('labels.seconds')}
          />
          <DialogActions>
            <Button emphasis="low" onClick={onClose}>
              {tCommon('actions.cancel')}
            </Button>
            <Button emphasis="strong" onClick={onSubmit} loading={isCreating} disabled={!canEdit || !title.trim()}>
              {tCommon('actions.add')}
            </Button>
          </DialogActions>
        </DsLayoutStack>
      </ContentModal>
    </>
  );
}

export function secondsToTimePickerValue(seconds: number | ''): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    return '';
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainderSeconds = totalSeconds % 60;

  return [hours, minutes, remainderSeconds].map((part) => part.toString().padStart(2, '0')).join(':');
}

export function timePickerValueToSeconds(value: string): number | '' {
  if (!value) {
    return '';
  }

  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) {
    return '';
  }

  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? '0');
}
