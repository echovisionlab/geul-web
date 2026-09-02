'use client';

import { forwardRef, type AriaAttributes, type MouseEventHandler, type ReactNode } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { createPolymorphicComponent, Menu as MantineMenu, type MenuProps as MantineMenuProps } from '@mantine/core';
import { getControlToneColor, type ControlTone } from '../control-style';
import classes from './DropdownMenu.module.css';

export type DropdownMenuSize = 'compact' | 'standard' | 'wide' | 'expanded';
export type DropdownMenuPlacement =
  'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'right-start' | 'left-start';
export type DropdownMenuTrigger = NonNullable<MantineMenuProps['trigger']>;
export type DropdownMenuSubPlacement = 'right-start' | 'left-start';

export interface DropdownMenuProps {
  children?: ReactNode;
  size?: DropdownMenuSize;
  placement?: DropdownMenuPlacement;
  trigger?: DropdownMenuTrigger;
  portal?: boolean;
  arrow?: boolean;
  opened?: boolean;
  defaultOpened?: boolean;
  onChange?: (opened: boolean) => void;
  onOpen?: () => void;
  onClose?: () => void;
  closeOnItemClick?: boolean;
  loop?: boolean;
  id?: string;
}

export interface DropdownMenuItemProps {
  children?: ReactNode;
  icon?: ReactNode;
  tone?: ControlTone;
  selected?: boolean;
  disabled?: boolean;
  'aria-current'?: AriaAttributes['aria-current'];
}

export interface DropdownMenuDropdownProps {
  children?: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onMouseDown?: MouseEventHandler<HTMLDivElement>;
  [dataAttribute: `data-${string}`]: string | number | boolean | undefined;
}

export interface DropdownMenuLabelProps {
  children?: ReactNode;
}

export interface DropdownMenuDividerProps {}

export interface DropdownMenuSubProps {
  children?: ReactNode;
  size?: DropdownMenuSize;
  placement?: DropdownMenuSubPlacement;
}

export interface DropdownMenuSubTargetProps {
  children: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface DropdownMenuSubDropdownProps {
  children?: ReactNode;
}

const DROPDOWN_MENU_WIDTHS: Record<DropdownMenuSize, number> = {
  compact: 160,
  standard: 200,
  wide: 240,
  expanded: 320,
};

const DROPDOWN_MENU_CHROME_STYLES = {
  dropdown: {
    padding: '3px',
  },
  item: {
    minHeight: '30px',
    padding: '4px 8px',
    gap: '6px',
    borderRadius: 0,
    fontSize: 'var(--mantine-font-size-xs)',
  },
  itemLabel: {
    minWidth: 0,
    lineHeight: 1.25,
    overflowWrap: 'anywhere',
  },
  itemSection: {
    width: '16px',
    minWidth: '16px',
    height: '16px',
    flex: '0 0 16px',
    marginInline: 0,
    lineHeight: 0,
  },
  label: {
    padding: '3px 8px',
    fontSize: '10px',
    fontWeight: 600,
    lineHeight: 1.2,
  },
  divider: {
    margin: '3px 2px',
  },
  chevron: {
    width: '14px',
    height: '14px',
  },
} satisfies NonNullable<MantineMenuProps['styles']>;

function DropdownMenuRoot({
  children,
  size = 'standard',
  placement = 'bottom-start',
  trigger = 'click',
  portal = true,
  arrow = false,
  ...props
}: DropdownMenuProps) {
  return (
    <MantineMenu
      {...props}
      width={DROPDOWN_MENU_WIDTHS[size]}
      position={placement}
      trigger={trigger}
      withinPortal={portal}
      withArrow={arrow}
      shadow="md"
      radius={0}
      transitionProps={trigger === 'hover' ? { exitDuration: 0 } : undefined}
      classNames={{ itemSection: classes.itemSection }}
      styles={DROPDOWN_MENU_CHROME_STYLES}
    >
      {children}
    </MantineMenu>
  );
}

DropdownMenuRoot.displayName = 'DropdownMenu';

function DropdownMenuItemInner(
  { children, icon, tone, selected = false, disabled, 'aria-current': ariaCurrent, ...props }: DropdownMenuItemProps,
  ref: React.ForwardedRef<HTMLButtonElement>,
) {
  return (
    <MantineMenu.Item
      ref={ref}
      {...props}
      leftSection={icon}
      rightSection={selected ? <IconCheck size={14} aria-hidden /> : undefined}
      color={tone ? getControlToneColor(tone) : undefined}
      fw={selected ? 600 : undefined}
      disabled={disabled}
      aria-current={ariaCurrent ?? (selected ? 'true' : undefined)}
      data-selected={selected || undefined}
      data-tone={tone}
    >
      {children}
    </MantineMenu.Item>
  );
}

const DropdownMenuItemBase = forwardRef<HTMLButtonElement, DropdownMenuItemProps>(DropdownMenuItemInner);
DropdownMenuItemBase.displayName = 'DropdownMenu.Item';

const DropdownMenuItem = createPolymorphicComponent<'button', DropdownMenuItemProps>(DropdownMenuItemBase);

const DropdownMenuDropdown = forwardRef<HTMLDivElement, DropdownMenuDropdownProps>((props, ref) => (
  <MantineMenu.Dropdown ref={ref} {...props} />
));
DropdownMenuDropdown.displayName = 'DropdownMenu.Dropdown';

const DropdownMenuLabel = forwardRef<HTMLDivElement, DropdownMenuLabelProps>((props, ref) => (
  <MantineMenu.Label ref={ref} {...props} />
));
DropdownMenuLabel.displayName = 'DropdownMenu.Label';

const DropdownMenuDivider = forwardRef<HTMLDivElement, DropdownMenuDividerProps>((props, ref) => (
  <MantineMenu.Divider ref={ref} {...props} />
));
DropdownMenuDivider.displayName = 'DropdownMenu.Divider';

function DropdownMenuSubRoot({ children, size = 'standard', placement = 'right-start' }: DropdownMenuSubProps) {
  // Mantine submenus consume the parent Menu context, including the shared styles and classNames above.
  return (
    <MantineMenu.Sub width={DROPDOWN_MENU_WIDTHS[size]} position={placement} shadow="md" radius={0}>
      {children}
    </MantineMenu.Sub>
  );
}

DropdownMenuSubRoot.displayName = 'DropdownMenu.Sub';

const DropdownMenuSubTarget = forwardRef<HTMLButtonElement, DropdownMenuSubTargetProps>(
  ({ children, icon, disabled }, ref) => (
    <MantineMenu.Sub.Target>
      <MantineMenu.Sub.Item ref={ref} leftSection={icon} disabled={disabled}>
        {children}
      </MantineMenu.Sub.Item>
    </MantineMenu.Sub.Target>
  ),
);
DropdownMenuSubTarget.displayName = 'DropdownMenu.Sub.Target';

const DropdownMenuSubDropdown = forwardRef<HTMLDivElement, DropdownMenuSubDropdownProps>((props, ref) => (
  <MantineMenu.Sub.Dropdown ref={ref} {...props} />
));
DropdownMenuSubDropdown.displayName = 'DropdownMenu.Sub.Dropdown';

const DropdownMenuSub = Object.assign(DropdownMenuSubRoot, {
  Target: DropdownMenuSubTarget,
  Dropdown: DropdownMenuSubDropdown,
});

export const DropdownMenu = Object.assign(DropdownMenuRoot, {
  Target: MantineMenu.Target,
  Dropdown: DropdownMenuDropdown,
  Item: DropdownMenuItem,
  Label: DropdownMenuLabel,
  Divider: DropdownMenuDivider,
  Sub: DropdownMenuSub,
});
