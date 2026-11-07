'use client';

// Light part of DropdownMenu shared by the eager `DropdownMenu` and `OnDemandDropdownMenu`:
// open state, hover intent, overlay-hint registration and the trigger target. It must not import
// React Aria Menu/Popover; `OnDemandDropdownMenu` keeps those in the lazily loaded surface.

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ContextType,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { OverlayPresentationProps } from '../overlay-contract';
import { usePress } from 'react-aria/usePress';
import { OverlayTriggerTarget } from '../OverlayTriggerTarget';
import { OverlayHintContext } from '../overlay-hint-context';
import { primitiveTokens } from '@echovisionlab/design-system/tokens';

export type DropdownMenuSize = 'compact' | 'standard' | 'wide' | 'expanded';
export type DropdownMenuPlacement =
  'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'right-start' | 'left-start';
export type DropdownMenuTrigger = 'click' | 'hover' | 'click-hover';
export type DropdownMenuSubPlacement = 'right-start' | 'left-start';
export interface DropdownMenuProps extends OverlayPresentationProps {
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

export interface DropdownMenuPresentation {
  size: DropdownMenuSize;
  placement: DropdownMenuPlacement;
  portal: boolean;
  arrow: boolean;
  loop: boolean;
  closeOnItemClick: boolean;
  id?: string;
  container: HTMLSpanElement | null;
  enter: () => void;
  leave: () => void;
}
export const MenuPresentation = createContext<DropdownMenuPresentation | null>(null);

/** Open state, hover intent and overlay-hint suppression of one DropdownMenu root. */
export function useDropdownMenuRoot({
  size = 'standard',
  placement = 'bottom-start',
  trigger = 'click',
  portal = true,
  arrow = false,
  opened,
  defaultOpened = false,
  onChange,
  onOpen,
  onClose,
  closeOnItemClick = true,
  loop = true,
  id,
}: DropdownMenuProps) {
  const parentHint = useContext(OverlayHintContext);
  const registerOverlay = parentHint?.registerOverlay;
  const hintId = useId();
  const [localOpen, setLocalOpen] = useState(defaultOpened);
  const [container, setContainer] = useState<HTMLSpanElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open = opened ?? localOpen;
  useLayoutEffect(() => {
    registerOverlay?.(hintId, open);
    return () => registerOverlay?.(hintId, false);
  }, [registerOverlay, hintId, open]);
  const change = (next: boolean) => {
    if (next === open) {
      return;
    }
    setLocalOpen(next);
    onChange?.(next);
    if (next) {
      onOpen?.();
    } else {
      onClose?.();
    }
  };
  const enter = () => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    if (trigger !== 'click') {
      change(true);
    }
  };
  const leave = () => {
    if (trigger !== 'click') {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => change(false), Number.parseInt(primitiveTokens.motion.normal, 10));
    }
  };
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );
  const hint: NonNullable<ContextType<typeof OverlayHintContext>> = {
    suppressed: open || Boolean(parentHint?.suppressed),
    registerOverlay,
  };
  const presentation: DropdownMenuPresentation = {
    size,
    placement,
    portal,
    arrow,
    loop,
    closeOnItemClick,
    id,
    container,
    enter,
    leave,
  };
  return { open, change, enter, leave, hint, presentation, setContainer };
}

export const DropdownMenuTarget = forwardRef<HTMLElement, { children: ReactElement }>(({ children }, ref) => (
  <OverlayTriggerTarget forwardedRef={ref}>{children}</OverlayTriggerTarget>
));
DropdownMenuTarget.displayName = 'DropdownMenu.Target';

/**
 * Viewport point a programmatically opened menu (a context menu) is positioned from. It is not a
 * control: it joins the menu trigger only as the positioning reference, outside the tab order and
 * the accessibility tree. Focus moves into the menu when it opens.
 */
export function DropdownMenuAnchor({ x, y, className }: { x: number; y: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  usePress({ ref });
  return <span ref={ref} className={className} style={{ left: x, top: y }} aria-hidden data-dropdown-menu-anchor />;
}

/** Marks a component that `DropdownMenu.Dropdown` treats as a section label. */
export const DROPDOWN_MENU_LABEL = Symbol.for('core.dropdown-menu.label');
export function isDropdownMenuLabelType(type: unknown) {
  return typeof type === 'object' || typeof type === 'function'
    ? Boolean(type && (type as { [DROPDOWN_MENU_LABEL]?: boolean })[DROPDOWN_MENU_LABEL])
    : false;
}
