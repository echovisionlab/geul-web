'use client';

// Light part of Tooltip shared by the eager `Tooltip` and `OnDemandTooltip`: overlay-hint
// suppression, hover-only tracking and the trigger options. It must not import React Aria's
// Tooltip module; `OnDemandTooltip` keeps that (and overlay positioning) in the lazy surface.

import { useCallback, useContext, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import type { OverlayPresentationProps } from '../overlay-contract';
import { OverlayHintContext } from '../overlay-hint-context';
import { OverlayTargetRefContext, OverlayTargetPressContext } from '../overlay-target-context';

export interface TooltipProps extends OverlayPresentationProps {
  label: ReactNode;
  children: ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
  opened?: boolean;
  disabled?: boolean;
  openDelay?: number;
  closeDelay?: number;
  withinPortal?: boolean;
  withArrow?: boolean;
  multiline?: boolean;
  size?: 'content' | 'compact' | 'standard' | 'wide';
  tabIndex?: 0 | -1;
  events?: { hover?: boolean; focus?: boolean; touch?: false };
}

export function useTooltipRoot({
  opened,
  disabled = false,
  openDelay = 500,
  closeDelay = 100,
  events,
}: Pick<TooltipProps, 'opened' | 'disabled' | 'openDelay' | 'closeDelay' | 'events'>) {
  const parentHint = useContext(OverlayHintContext);
  const targetRef = useContext(OverlayTargetRefContext);
  const targetPress = useContext(OverlayTargetPressContext);
  const [openOverlays, setOpenOverlays] = useState<ReadonlySet<string>>(() => new Set());
  const registerOverlay = useCallback((id: string, open: boolean) => {
    setOpenOverlays((previous) => {
      if (previous.has(id) === open) {
        return previous;
      }
      const next = new Set(previous);
      if (open) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);
  const hintDisabled = disabled || Boolean(parentHint?.suppressed) || openOverlays.size > 0;
  const hintContext = useMemo(() => ({ suppressed: hintDisabled, registerOverlay }), [hintDisabled, registerOverlay]);
  const [container, setContainer] = useState<HTMLSpanElement | null>(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  // React Aria stays controlled for the trigger's lifetime: suppression forces `false`, so an
  // uncontrolled `undefined` would flip it between modes. Suppression also ends any open hint.
  const [localOpen, setLocalOpen] = useState(false);
  if (hintDisabled && localOpen) {
    setLocalOpen(false);
  }
  const hovering = useRef(false);
  const hoverOnly = events?.focus === false;
  const controlled = opened !== undefined;
  const anchorHandlers = {
    onPointerOverCapture: () => {
      hovering.current = true;
    },
    onMouseOverCapture: () => {
      hovering.current = true;
    },
    onPointerOutCapture: (event: { relatedTarget: EventTarget | null; currentTarget: HTMLElement }) => {
      if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
        hovering.current = false;
      }
    },
    onMouseOutCapture: (event: { relatedTarget: EventTarget | null; currentTarget: HTMLElement }) => {
      if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
        hovering.current = false;
      }
    },
  };
  /** Props of React Aria `TooltipTrigger` (and of its state/trigger hooks). */
  const triggerOptions = {
    isOpen: hintDisabled ? false : controlled ? opened : hoverOnly ? hoverOpen : localOpen,
    onOpenChange: (open: boolean) => {
      if (hoverOnly) {
        if (!open || hovering.current) {
          setHoverOpen(open);
        }
      } else if (!controlled) {
        setLocalOpen(open);
      }
    },
    isDisabled: hintDisabled,
    delay: openDelay,
    closeDelay,
    trigger: events?.hover === false ? ('focus' as const) : undefined,
  };
  return { hintContext, container, setContainer, anchorHandlers, triggerOptions, targetRef, targetPress };
}
