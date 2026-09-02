import { Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';

interface TranslationDeleteConfirmOptions {
  title: string;
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  onConfirm: () => void;
}

export function openTranslationDeleteConfirm({
  title,
  cancelLabel,
  confirmLabel,
  description,
  onConfirm,
}: TranslationDeleteConfirmOptions): void {
  modals.openConfirmModal({
    title,
    labels: { cancel: cancelLabel, confirm: confirmLabel },
    confirmProps: { color: 'red' },
    children: (
      <Stack gap="xs">
        <Text size="sm">{description}</Text>
      </Stack>
    ),
    onConfirm,
  });
}
