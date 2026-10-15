import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';

import { confirmationDialogs } from '@/features/confirmation';

interface TranslationDeleteConfirmOptions {
  title: string;
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  onConfirm: () => void | Promise<void>;
}

export function openTranslationDeleteConfirm({
  title,
  cancelLabel,
  confirmLabel,
  description,
  onConfirm,
}: TranslationDeleteConfirmOptions): void {
  confirmationDialogs.open({
    title,
    cancelLabel,
    confirmLabel,
    closeLabel: cancelLabel,
    intent: 'delete',
    message: (
      <DsLayoutStack gap="xs">
        <DsText>{description}</DsText>
      </DsLayoutStack>
    ),
    onConfirm,
  });
}
