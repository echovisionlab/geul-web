'use client';

import type { OverlayPresentationProps } from '../overlay-contract';

import { forwardRef, type ReactNode } from 'react';
import { OverlayDialog, type OverlayDialogDensity } from '../Modal/OverlayDialog';
import { useDrawerDesktop } from './drawer-visibility';

export type DrawerPlacement = 'left' | 'right' | 'bottom';
export type DrawerDensity = OverlayDialogDensity;
export type DrawerSize = 'compact' | 'standard' | 'large' | 'auto';
export type DrawerClosePolicy = 'dismissible' | 'non-dismissible';
export type DrawerVisibility = 'always' | 'mobile-only';

export interface DrawerProps extends OverlayPresentationProps {
  id?: string;
  opened: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  closeLabel: string;
  placement?: DrawerPlacement;
  size?: DrawerSize;
  density?: DrawerDensity;
  closePolicy?: DrawerClosePolicy;
  loading?: boolean;
  visibility?: DrawerVisibility;
}

export const Drawer = forwardRef<HTMLDivElement, DrawerProps>(
  (
    {
      id,
      opened,
      onClose,
      title,
      children,
      closeLabel,
      placement = 'right',
      size = 'standard',
      density = 'compact',
      closePolicy = 'dismissible',
      loading = false,
      visibility = 'always',
    },
    ref,
  ) => {
    const desktop = useDrawerDesktop();
    return (
      <OverlayDialog
        ref={ref}
        id={id}
        opened={opened && (visibility !== 'mobile-only' || !desktop)}
        onClose={onClose}
        title={title}
        closeLabel={closeLabel}
        placement={placement}
        size={size}
        density={density}
        dismissible={closePolicy === 'dismissible' && !loading}
        busy={loading}
        mobileOnly={visibility === 'mobile-only'}
      >
        {children}
      </OverlayDialog>
    );
  },
);
Drawer.displayName = 'Drawer';
