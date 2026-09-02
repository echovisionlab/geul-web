'use client';

import type { ReactNode } from 'react';
import { Modal, type ModalProps as MantineModalProps } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import classes from './ContentModal.module.css';

export type ContentModalSize = 'compact' | 'standard' | 'large' | 'wide' | 'workspace';

export interface ContentModalProps {
  id?: string;
  opened: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  centered?: boolean;
  size?: ContentModalSize;
}

const MODAL_SIZES: Record<ContentModalSize, NonNullable<MantineModalProps['size']>> = {
  compact: 'sm',
  standard: 'md',
  large: 'lg',
  wide: '60rem',
  workspace: 'calc(100vw - 3rem)',
};

export function ContentModal({
  id,
  opened,
  onClose,
  title,
  closeLabel,
  children,
  centered = false,
  size = 'standard',
}: ContentModalProps) {
  const workspaceMobile = useMediaQuery('(max-width: 47.99em)');
  const workspace = size === 'workspace';

  return (
    <Modal
      id={id}
      opened={opened}
      onClose={onClose}
      title={title}
      closeButtonProps={{ 'aria-label': closeLabel }}
      centered={centered}
      size={MODAL_SIZES[size]}
      xOffset={workspace ? '1.5rem' : size === 'wide' ? '1rem' : undefined}
      yOffset={workspace ? '1.5rem' : undefined}
      fullScreen={workspace && workspaceMobile}
      radius={0}
      overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
      classNames={
        workspace
          ? {
              content: classes.workspaceContent,
              header: classes.workspaceHeader,
              body: classes.workspaceBody,
            }
          : undefined
      }
      data-centered={centered || undefined}
      data-size={size}
    >
      {children}
    </Modal>
  );
}
