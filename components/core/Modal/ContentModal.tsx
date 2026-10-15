'use client';

import type { OverlayPresentationProps } from '../overlay-contract';

import type { ReactNode } from 'react';
import { OverlayDialog, type OverlayDialogDensity } from './OverlayDialog';

export type ContentModalDensity = OverlayDialogDensity;

export type ContentModalSize = 'compact' | 'standard' | 'large' | 'wide' | 'workspace';

export interface ContentModalProps extends OverlayPresentationProps {
  id?: string;
  opened: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  centered?: boolean;
  /** Lock escape, outside press and close control while an owned operation is pending. */
  loading?: boolean;
  closePolicy?: 'dismissible' | 'non-dismissible';
  size?: ContentModalSize;
  density?: ContentModalDensity;
  /** Fit resizable media/work areas to the viewport; content must own its shrinking behavior. */
  bodyLayout?: 'scroll' | 'fit';
}

export function ContentModal({
  id,
  opened,
  onClose,
  title,
  closeLabel,
  children,
  centered = false,
  size = 'standard',
  density = 'compact',
  bodyLayout = 'scroll',
  loading = false,
  closePolicy = 'dismissible',
}: ContentModalProps) {
  return (
    <OverlayDialog
      id={id}
      opened={opened}
      onClose={onClose}
      title={title}
      closeLabel={closeLabel}
      dismissible={closePolicy === 'dismissible' && !loading}
      busy={loading}
      centered={centered}
      size={size}
      density={density}
      bodyLayout={bodyLayout}
    >
      {children}
    </OverlayDialog>
  );
}
