'use client';

import type { OverlayPresentationProps } from '../overlay-contract';

import { forwardRef, type MouseEventHandler } from 'react';
import { IconMenu2, IconX } from '@tabler/icons-react';
import { IconButton } from '../IconButton/IconButton';
import classes from './MenuToggle.module.css';
export type MenuToggleVisibility = 'always' | 'mobile-only';
/** Disclosure toggle for a navigation region: owns aria-expanded/aria-controls and the menu/close glyph swap. */
export interface MenuToggleProps extends OverlayPresentationProps {
  opened: boolean;
  label: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  visibility?: MenuToggleVisibility;
  controls?: string;
  disabled?: boolean;
  /** Uses the shared pending control while the navigation surface loads; focus remains on the toggle. */
  loading?: boolean;
  id?: string;
}
export const MenuToggle = forwardRef<HTMLButtonElement, MenuToggleProps>(
  ({ opened, label, onClick, visibility = 'always', controls, disabled, loading, id }, ref) => (
    <span className={classes.root} data-visibility={visibility}>
      <IconButton
        ref={ref}
        id={id}
        size="chrome"
        label={label}
        disabled={disabled}
        loading={loading}
        onClick={disabled ? undefined : onClick}
        aria-expanded={opened}
        aria-controls={controls}
        data-opened={opened}
        data-menu-toggle
      >
        {opened ? <IconX size="1em" aria-hidden /> : <IconMenu2 size="1em" aria-hidden />}
      </IconButton>
    </span>
  ),
);
MenuToggle.displayName = 'MenuToggle';
