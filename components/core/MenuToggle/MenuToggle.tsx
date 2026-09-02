'use client';

import { forwardRef, type MouseEventHandler } from 'react';
import { Burger as MantineBurger } from '@mantine/core';

export type MenuToggleSize = 'compact' | 'standard';
export type MenuToggleVisibility = 'always' | 'mobile-only';

export interface MenuToggleProps {
  opened: boolean;
  label: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  size?: MenuToggleSize;
  visibility?: MenuToggleVisibility;
  controls?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

const MENU_TOGGLE_SIZES = {
  compact: { icon: 16, control: 32 },
  standard: { icon: 20, control: 40 },
} as const;

export const MenuToggle = forwardRef<HTMLButtonElement, MenuToggleProps>(
  ({ opened, label, onClick, size = 'standard', visibility = 'always', controls, disabled, ...props }, ref) => {
    const dimensions = MENU_TOGGLE_SIZES[size];

    return (
      <MantineBurger
        ref={ref}
        {...props}
        type="button"
        opened={opened}
        onClick={onClick}
        disabled={disabled}
        size={dimensions.icon}
        w={dimensions.control}
        h={dimensions.control}
        hiddenFrom={visibility === 'mobile-only' ? 'sm' : undefined}
        aria-label={label}
        aria-expanded={opened}
        aria-controls={controls}
        data-opened={opened}
        data-size={size}
        data-visibility={visibility}
        data-menu-toggle
      />
    );
  },
);

MenuToggle.displayName = 'MenuToggle';
