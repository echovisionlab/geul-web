import type { ControlEmphasis, ControlTone } from '@/components/core/control-style';

export type ConfirmationIntent = 'delete' | 'discard' | 'revoke' | 'archive' | 'restore' | 'regenerate' | 'confirm';

/** Domain intent chooses a treatment; all colors and interaction states remain Core-owned. */
export const confirmationTreatments = {
  delete: { tone: 'danger', emphasis: 'strong' },
  discard: { tone: 'danger', emphasis: 'strong' },
  revoke: { tone: 'danger', emphasis: 'strong' },
  archive: { tone: 'warning', emphasis: 'strong' },
  restore: { tone: 'positive', emphasis: 'strong' },
  regenerate: { tone: 'warning', emphasis: 'strong' },
  confirm: { tone: 'neutral', emphasis: 'strong' },
} as const satisfies Record<ConfirmationIntent, { tone: ControlTone; emphasis: ControlEmphasis }>;
