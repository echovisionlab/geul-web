'use client';

import { forwardRef, type ReactNode } from 'react';
import { Drawer as MantineDrawer, type DrawerProps as MantineDrawerProps } from '@mantine/core';

export type DrawerPlacement = 'left' | 'right' | 'bottom';
export type DrawerSize = 'compact' | 'standard' | 'large' | 'auto';
export type DrawerClosePolicy = 'dismissible' | 'non-dismissible';
export type DrawerVisibility = 'always' | 'mobile-only';

export interface DrawerProps {
  opened: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  closeLabel: string;
  placement?: DrawerPlacement;
  size?: DrawerSize;
  closePolicy?: DrawerClosePolicy;
  loading?: boolean;
  visibility?: DrawerVisibility;
}

type ResolvedDrawerSize = NonNullable<MantineDrawerProps['size']>;

const SIDE_SIZES: Record<DrawerSize, ResolvedDrawerSize> = {
  compact: 'sm',
  standard: 'md',
  large: 'lg',
  auto: 'auto',
};

const BOTTOM_SIZES: Record<DrawerSize, ResolvedDrawerSize> = {
  compact: '60%',
  standard: '80%',
  large: '85%',
  auto: 'auto',
};

function resolveSize(placement: DrawerPlacement, size: DrawerSize) {
  return placement === 'bottom' ? BOTTOM_SIZES[size] : SIDE_SIZES[size];
}

export const Drawer = forwardRef<HTMLDivElement, DrawerProps>(
  (
    {
      opened,
      onClose,
      title,
      children,
      closeLabel,
      placement = 'right',
      size = 'standard',
      closePolicy = 'dismissible',
      loading = false,
      visibility = 'always',
    },
    ref,
  ) => {
    const dismissible = closePolicy === 'dismissible' && !loading;

    return (
      <MantineDrawer
        ref={ref}
        opened={opened}
        onClose={dismissible ? onClose : () => {}}
        title={title}
        position={placement}
        size={resolveSize(placement, size)}
        radius={0}
        hiddenFrom={visibility === 'mobile-only' ? 'sm' : undefined}
        closeOnClickOutside={dismissible}
        closeOnEscape={dismissible}
        withCloseButton={dismissible}
        closeButtonProps={{ 'aria-label': closeLabel }}
        aria-busy={loading || undefined}
        data-placement={placement}
        data-size={size}
        data-close-policy={dismissible ? 'dismissible' : 'non-dismissible'}
        data-loading={loading || undefined}
      >
        {children}
      </MantineDrawer>
    );
  },
);

Drawer.displayName = 'Drawer';
