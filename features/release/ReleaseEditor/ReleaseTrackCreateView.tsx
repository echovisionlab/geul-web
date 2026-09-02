'use client';

import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Group, Modal, Stack } from '@mantine/core';
import { TimePicker } from '@mantine/dates';
import { Button } from '@/components/core/Button';
import { TextInput } from '@/components/core/Input';

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
  const tCommon = useTranslations('common');
  const t = useTranslations('releaseEditor.tracks');

  return (
    <>
      <Button
        id={idPrefix ? `${idPrefix}-add-button` : 'release-track-add-button'}
        emphasis="medium"
        size="xs"
        leftSection={<IconPlus size={14} />}
        onClick={onOpen}
      >
        {tCommon('actions.addItem', { item: tCommon('entities.track') })}
      </Button>

      <Modal opened={opened} onClose={onClose} title={t('addModal.title')}>
        <Stack>
          <TextInput
            id={idPrefix ? `${idPrefix}-title-input` : 'release-track-add-title-input'}
            label={tCommon('labels.title')}
            placeholder={t('placeholders.title')}
            value={title}
            onChange={(event) => onTitleChange(event.currentTarget.value)}
            required
          />
          <TimePicker
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
          <Group justify="flex-end">
            <Button emphasis="low" onClick={onClose}>
              {tCommon('actions.cancel')}
            </Button>
            <Button onClick={onSubmit} loading={isCreating} disabled={!title.trim()}>
              {tCommon('actions.add')}
            </Button>
          </Group>
        </Stack>
      </Modal>
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
