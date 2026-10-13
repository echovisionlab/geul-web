'use client';

import {
  createContext,
  forwardRef,
  useContext,
  useState,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Dialog, DialogTrigger, Popover as AriaPopover } from 'react-aria-components';
import { overlayDataAttributes, type OverlayPresentationProps } from '../overlay-contract';
import { OverlayTriggerTarget } from '../OverlayTriggerTarget';
import { overlayLayers } from '../layer-contract';
import classes from '../Overlay.module.css';
export type PopoverPlacement = 'bottom-start' | 'bottom' | 'bottom-end' | 'top-start' | 'top' | 'top-end';
export type PopoverSize = 'compact' | 'standard' | 'wide';
export type PopoverPadding = 'none' | 'compact' | 'standard';
export type PopoverRole = 'dialog' | 'alertdialog';
export interface PopoverProps extends OverlayPresentationProps {
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
export interface PopoverTargetProps extends OverlayPresentationProps {
  children: ReactElement;
}
export interface PopoverDropdownProps extends OverlayPresentationProps {
  children?: ReactNode;
  padding?: PopoverPadding;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  role?: PopoverRole;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onMouseDown?: MouseEventHandler<HTMLDivElement>;
  [dataAttribute: `data-${string}`]: string | number | boolean | undefined;
}
const PopoverPresentation = createContext<{
  placement: PopoverPlacement;
  size: PopoverSize;
  portal: boolean;
  container: HTMLSpanElement | null;
}>({ placement: 'bottom-start', size: 'standard', portal: true, container: null });
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
  const [container, setContainer] = useState<HTMLSpanElement | null>(null);
  return (
    <span ref={setContainer} className={classes.anchor}>
      <PopoverPresentation.Provider value={{ placement, size, portal, container }}>
        <DialogTrigger
          isOpen={open}
          defaultOpen={defaultOpen}
          onOpenChange={(next) => {
            onOpenChange?.(next);
            if (next) {
              onOpen?.();
            } else {
              onClose?.();
            }
          }}
        >
          {children}
        </DialogTrigger>
      </PopoverPresentation.Provider>
    </span>
  );
}
PopoverRoot.displayName = 'Popover';
const PopoverTarget = forwardRef<HTMLElement, PopoverTargetProps>(({ children }, ref) => (
  <OverlayTriggerTarget forwardedRef={ref}>{children}</OverlayTriggerTarget>
));
PopoverTarget.displayName = 'Popover.Target';
const PopoverDropdown = forwardRef<HTMLDivElement, PopoverDropdownProps>(
  (
    {
      padding = 'standard',
      children,
      id,
      role = 'dialog',
      onClick,
      onMouseDown,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    const presentation = useContext(PopoverPresentation);
    if (role !== 'dialog' && role !== 'alertdialog') {
      throw new RangeError('Invalid popover role');
    }
    return (
      <AriaPopover
        ref={ref}
        className={classes.popover}
        placement={presentation.placement.replace('-', ' ') as 'bottom start'}
        style={{ zIndex: overlayLayers.popup }}
        data-size={presentation.size}
        data-position={presentation.placement}
        UNSTABLE_portalContainer={!presentation.portal ? (presentation.container ?? undefined) : undefined}
        {...overlayDataAttributes(props)}
        onClick={onClick}
        onMouseDown={onMouseDown}
      >
        <Dialog
          id={id}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          role={role}
          className={classes.popoverContent}
          data-padding={padding}
        >
          {children}
        </Dialog>
      </AriaPopover>
    );
  },
);
PopoverDropdown.displayName = 'Popover.Dropdown';
export const Popover = Object.assign(PopoverRoot, { Target: PopoverTarget, Dropdown: PopoverDropdown });
