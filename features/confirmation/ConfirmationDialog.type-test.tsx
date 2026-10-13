import { ConfirmationDialog, type ConfirmationDialogProps, confirmationDialogs } from '@/features/confirmation';

const props = {
  opened: true,
  onClose: () => {},
  onConfirm: () => {},
  title: 'Delete',
  message: 'Remove this item?',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
  closeLabel: 'Close',
} satisfies Omit<ConfirmationDialogProps, 'intent'>;

<ConfirmationDialog {...props} intent="delete" />;
// @ts-expect-error Domain intent is required; a generic dialog is not implicitly destructive.
<ConfirmationDialog {...props} />;
// @ts-expect-error Feature callers cannot replace intent-owned emphasis.
<ConfirmationDialog {...props} intent="delete" confirmEmphasis="low" />;
// @ts-expect-error Feature callers cannot replace intent-owned tone through a spread.
<ConfirmationDialog {...props} {...({ intent: 'delete', confirmTone: 'neutral' } as const)} />;
// @ts-expect-error Feature has no background/style escape.
<ConfirmationDialog {...props} intent="delete" style={{ background: 'red' }} />;
// @ts-expect-error Imperative callers must also choose intent instead of raw tone.
confirmationDialogs.open({ ...props, intent: 'delete', tone: 'neutral' });
