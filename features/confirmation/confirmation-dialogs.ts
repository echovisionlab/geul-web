import { confirmDialogs, type ConfirmDialogOptions } from '@/components/core/Modal/confirm-dialogs';
import { confirmationTreatments, type ConfirmationIntent } from './ui/confirmation-intent';

export interface ConfirmationOptions extends Omit<ConfirmDialogOptions, 'tone' | 'emphasis'> {
  intent: ConfirmationIntent;
  tone?: never;
  emphasis?: never;
}

export const confirmationDialogs = {
  open({ intent, ...options }: ConfirmationOptions) {
    return confirmDialogs.open({ ...options, ...confirmationTreatments[intent] });
  },
  close: confirmDialogs.close,
};
