'use client';

import { forwardRef, type AriaRole, type MouseEventHandler, type ReactElement, type ReactNode } from 'react';
import { Popover as MantinePopover, type PopoverProps as MantinePopoverProps } from '@mantine/core';

export type PopoverPlacement = 'bottom-start' | 'bottom' | 'bottom-end' | 'top-start' | 'top' | 'top-end';
export type PopoverSize = 'compact' | 'standard' | 'wide';
export type PopoverPadding = 'none' | 'compact' | 'standard';

export interface PopoverProps {
  children?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpen?: () => void;
  onClose?: () => void;
  placement?: PopoverPlacement;
  size?: PopoverSize;
  portal?: boolean;
}

export interface PopoverTargetProps {
  children: ReactElement;
}

export interface PopoverDropdownProps {
  children?: ReactNode;
  padding?: PopoverPadding;
  id?: string;
  role?: AriaRole;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onMouseDown?: MouseEventHandler<HTMLDivElement>;
  [dataAttribute: `data-${string}`]: string | number | boolean | undefined;
}

type ResolvedPopoverPosition = NonNullable<MantinePopoverProps['position']>;

const POPOVER_POSITIONS: Record<PopoverPlacement, ResolvedPopoverPosition> = {
  'bottom-start': 'bottom-start',
  bottom: 'bottom',
  'bottom-end': 'bottom-end',
  'top-start': 'top-start',
  top: 'top',
  'top-end': 'top-end',
};

const POPOVER_WIDTHS: Record<PopoverSize, number> = {
  compact: 280,
  standard: 300,
  wide: 500,
};

function PopoverRoot({
  children,
  open,
  defaultOpen,
  onOpenChange,
  onOpen,
  onClose,
  placement = 'bottom-start',
  size = 'standard',
  portal = true,
}: PopoverProps) {
  return (
    <MantinePopover
      opened={open}
      defaultOpened={defaultOpen}
      onChange={onOpenChange}
      onOpen={onOpen}
      onClose={onClose}
      position={POPOVER_POSITIONS[placement]}
      width={POPOVER_WIDTHS[size]}
      withinPortal={portal}
      shadow="md"
      radius={0}
      styles={{
        dropdown: {
          boxSizing: 'border-box',
          maxWidth: 'calc(100vw - var(--mantine-spacing-xl))',
          overflowWrap: 'anywhere',
        },
      }}
    >
      {children}
    </MantinePopover>
  );
}

PopoverRoot.displayName = 'Popover';

const PopoverTarget = forwardRef<HTMLElement, PopoverTargetProps>(({ children }, ref) => (
  <MantinePopover.Target ref={ref}>{children}</MantinePopover.Target>
));

PopoverTarget.displayName = 'Popover.Target';

const PopoverDropdown = forwardRef<HTMLDivElement, PopoverDropdownProps>(({ padding = 'standard', ...props }, ref) => (
  <MantinePopover.Dropdown ref={ref} p={padding === 'none' ? 0 : padding === 'compact' ? 'xs' : undefined} {...props} />
));

PopoverDropdown.displayName = 'Popover.Dropdown';

export const Popover = Object.assign(PopoverRoot, {
  Target: PopoverTarget,
  Dropdown: PopoverDropdown,
});
