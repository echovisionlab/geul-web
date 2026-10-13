'use client';

import { forwardRef, useMemo, type ReactNode, type Ref, type RefObject } from 'react';
import {
  OverlayArrow,
  Tooltip as AriaTooltip,
  TooltipContext,
  TooltipTrigger,
  TooltipTriggerStateContext,
} from 'react-aria-components';
import type { TooltipTriggerState } from 'react-stately/useTooltipTriggerState';
import { OverlayHintContext } from '../overlay-hint-context';
import { OverlayTriggerTarget } from '../OverlayTriggerTarget';
import { overlayLayers } from '../layer-contract';
import classes from '../Overlay.module.css';
import { useTooltipRoot, type TooltipProps } from './tooltip-root';
export type { TooltipProps } from './tooltip-root';

type TooltipPopupProps = Pick<TooltipProps, 'label' | 'position' | 'withArrow' | 'multiline' | 'size'> & {
  popupRef?: Ref<HTMLDivElement>;
  portalContainer?: Element;
};

/** The positioned hint surface; reads the trigger state/props from React Aria contexts. */
function TooltipPopup({
  popupRef,
  label,
  position = 'top',
  withArrow = false,
  multiline = false,
  size = 'content',
  portalContainer,
}: TooltipPopupProps) {
  return (
    <AriaTooltip
      ref={popupRef}
      className={classes.tooltip}
      placement={position.replace('-', ' ') as 'top'}
      style={{ zIndex: overlayLayers.tooltip }}
      data-size={size}
      data-multiline={multiline || undefined}
      UNSTABLE_portalContainer={portalContainer}
    >
      {withArrow ? <TooltipArrow /> : null}
      {label}
    </AriaTooltip>
  );
}

export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
  (
    {
      label,
      children,
      position = 'top',
      withinPortal = true,
      withArrow = false,
      multiline = false,
      size = 'content',
      tabIndex,
      ...options
    },
    ref,
  ) => {
    const { hintContext, container, setContainer, anchorHandlers, triggerOptions, targetRef, targetPress } =
      useTooltipRoot(options);
    return (
      <OverlayHintContext.Provider value={hintContext}>
        <span ref={setContainer} className={classes.anchor} {...anchorHandlers}>
          <TooltipTrigger {...triggerOptions}>
            <OverlayTriggerTarget focusOnly={!targetPress} tabIndex={tabIndex} forwardedRef={targetRef}>
              {children}
            </OverlayTriggerTarget>
            <TooltipPopup
              popupRef={ref}
              label={label}
              position={position}
              withArrow={withArrow}
              multiline={multiline}
              size={size}
              portalContainer={!withinPortal ? (container ?? undefined) : undefined}
            />
          </TooltipTrigger>
        </span>
      </OverlayHintContext.Provider>
    );
  },
);
Tooltip.displayName = 'Tooltip';

/**
 * The contexts `TooltipTrigger` provides, around the hint surface, for a trigger whose state lives in
 * the light `OnDemandTooltip`. Used only by the on-demand surface; equal to `TooltipTrigger`'s values.
 */
export function TooltipSurface({
  state,
  tooltipProps,
  triggerRef,
  ...popup
}: TooltipPopupProps & {
  state: TooltipTriggerState;
  tooltipProps: object;
  triggerRef: RefObject<HTMLElement | null>;
}) {
  return (
    <TooltipTriggerStateContext.Provider value={state}>
      <TooltipContext.Provider value={{ ...tooltipProps, triggerRef }}>
        <TooltipPopup {...popup} />
      </TooltipContext.Provider>
    </TooltipTriggerStateContext.Provider>
  );
}

function TooltipArrow() {
  return (
    <OverlayArrow className={classes.arrow}>
      <svg width="8" height="8" viewBox="0 0 8 8">
        <path d="M0 0L4 4L8 0" />
      </svg>
    </OverlayArrow>
  );
}

/**
 * Core tooltip surface for a host that already owns hover/focus state, such as a radio segment.
 * It positions against `triggerRef` without wrapping the host in another trigger or tab stop.
 */
export function AnchoredTooltip({
  triggerRef,
  isOpen,
  label,
  position = 'top',
  withArrow = false,
}: {
  triggerRef: RefObject<Element | null>;
  isOpen: boolean;
  label: ReactNode;
  position?: TooltipProps['position'];
  withArrow?: boolean;
}) {
  // React Aria's standalone Tooltip positions from its own local state but its inner surface reads
  // the trigger-state context; provide the host-owned state so both agree.
  const state = useMemo(() => ({ isOpen, shouldSkipAnimation: false, open: () => {}, close: () => {} }), [isOpen]);
  return (
    <TooltipTriggerStateContext.Provider value={state}>
      <AriaTooltip
        triggerRef={triggerRef}
        isOpen={isOpen}
        className={classes.tooltip}
        placement={position.replace('-', ' ') as 'top'}
        style={{ zIndex: overlayLayers.tooltip }}
        data-size="content"
      >
        {withArrow ? <TooltipArrow /> : null}
        {label}
      </AriaTooltip>
    </TooltipTriggerStateContext.Provider>
  );
}
