'use client';

import { forwardRef, useRef } from 'react';
import { useTooltipTrigger } from 'react-aria/useTooltipTrigger';
import { FocusableProvider } from 'react-aria/private/interactions/useFocusable';
import { useTooltipTriggerState } from 'react-stately/useTooltipTriggerState';
import { onDemandModule, useOnDemandModule } from '../on-demand-module';
import { OverlayHintContext } from '../overlay-hint-context';
import { OverlayTriggerTarget } from '../OverlayTriggerTarget';
import classes from '../Overlay.module.css';
import { useTooltipRoot, type TooltipProps } from './tooltip-root';

const surface = onDemandModule(() => import('./Tooltip'));

/** Starts loading the hint surface (React Aria Tooltip and overlay positioning). */
export const preloadTooltip = surface.preload;

/**
 * `Tooltip` with the same props, markup and behaviour (hover/focus delays, warm-up across hints,
 * `aria-describedby` while shown, suppression by an open menu), for always-present chrome. The
 * trigger uses React Aria's tooltip trigger hooks directly; the positioned surface loads when the
 * pointer enters or focus arrives, normally well within the open delay. After the first load every
 * instance shows synchronously. Use `Tooltip` inside screens that already ship overlay code.
 */
export const OnDemandTooltip = forwardRef<HTMLDivElement, TooltipProps>(
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
    // Same props React Aria `TooltipTrigger` passes to these hooks.
    const state = useTooltipTriggerState(triggerOptions);
    const triggerRef = useRef<HTMLElement>(null);
    const { triggerProps, tooltipProps } = useTooltipTrigger(triggerOptions, state, triggerRef);
    const loaded = useOnDemandModule(surface, state.isOpen);
    return (
      <OverlayHintContext.Provider value={hintContext}>
        <span
          ref={setContainer}
          className={classes.anchor}
          {...anchorHandlers}
          onPointerEnter={surface.preload}
          onFocus={surface.preload}
        >
          <FocusableProvider {...triggerProps} ref={triggerRef}>
            <OverlayTriggerTarget focusOnly={!targetPress} tabIndex={tabIndex} forwardedRef={targetRef}>
              {children}
            </OverlayTriggerTarget>
            {loaded ? (
              <loaded.TooltipSurface
                state={state}
                tooltipProps={tooltipProps}
                triggerRef={triggerRef}
                popupRef={ref}
                label={label}
                position={position}
                withArrow={withArrow}
                multiline={multiline}
                size={size}
                portalContainer={!withinPortal ? (container ?? undefined) : undefined}
              />
            ) : null}
          </FocusableProvider>
        </span>
      </OverlayHintContext.Provider>
    );
  },
);
// OverlayTriggerTarget and nested overlays recognise a hint by this name.
OnDemandTooltip.displayName = 'Tooltip';
