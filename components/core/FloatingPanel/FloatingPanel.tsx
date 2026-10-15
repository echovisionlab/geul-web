'use client';
import { forwardRef, useEffect, useRef, useState, type PointerEvent } from 'react';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import classes from './FloatingPanel.module.css';
export interface FloatingPanelProps extends PresentationProps {
  label: string;
  initialPosition: { top: number; left: number };
  dragHandleSelector: string;
  excludeDragHandleSelector?: string;
  constrainToViewport?: boolean;
}
/** Nonmodal floating tool. Position and dragging are behavior; chrome is fixed by Core. */
export const FloatingPanel = forwardRef<HTMLDivElement, FloatingPanelProps>(
  (
    {
      label,
      initialPosition,
      dragHandleSelector,
      excludeDragHandleSelector,
      constrainToViewport = true,
      children,
      ...props
    },
    forwardedRef,
  ) => {
    const element = useRef<HTMLDivElement | null>(null);
    const [position, setPosition] = useState(initialPosition);
    const drag = useRef<{ x: number; y: number; top: number; left: number; pointer: number } | null>(null);
    const clamp = (point: { top: number; left: number }) => {
      const safe = {
        top: Number.isFinite(point.top) ? point.top : 0,
        left: Number.isFinite(point.left) ? point.left : 0,
      };
      if (!constrainToViewport || !element.current) {
        return safe;
      }
      const bounds = element.current.getBoundingClientRect();
      const inset = 8;
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      return {
        top: Math.max(inset, Math.min(safe.top, Math.max(inset, viewportHeight - bounds.height - inset))),
        left: Math.max(inset, Math.min(safe.left, Math.max(inset, viewportWidth - bounds.width - inset))),
      };
    };
    useEffect(() => {
      setPosition(clamp(initialPosition));
      const resize = () => setPosition((current) => clamp(current));
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }, [initialPosition.top, initialPosition.left, constrainToViewport]);
    const startDrag = (event: PointerEvent<HTMLDivElement>) => {
      const target = event.target as Element;
      if (
        event.button !== 0 ||
        !target.closest(dragHandleSelector) ||
        (excludeDragHandleSelector && target.closest(excludeDragHandleSelector))
      ) {
        return;
      }
      drag.current = { x: event.clientX, y: event.clientY, ...position, pointer: event.pointerId };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };
    return (
      <div
        {...presentationAttributes(props)}
        ref={(node) => {
          element.current = node;
          if (typeof forwardedRef === 'function') {
            forwardedRef(node);
          } else if (forwardedRef) {
            forwardedRef.current = node;
          }
        }}
        role="dialog"
        aria-label={label}
        className={classes.panel}
        style={{ top: position.top, left: position.left }}
        onKeyDownCapture={(event) => {
          const target = event.target as Element;
          if (
            !target.closest('[data-interaction="drag-handle"]') ||
            !target.closest(dragHandleSelector) ||
            (excludeDragHandleSelector && target.closest(excludeDragHandleSelector))
          ) {
            return;
          }
          const direction = {
            ArrowUp: { top: -1, left: 0 },
            ArrowDown: { top: 1, left: 0 },
            ArrowLeft: { top: 0, left: -1 },
            ArrowRight: { top: 0, left: 1 },
          }[event.key];
          if (!direction) {
            return;
          }
          event.preventDefault();
          const step = event.shiftKey ? 40 : 10;
          setPosition((current) =>
            clamp({
              top: current.top + direction.top * step,
              left: current.left + direction.left * step,
            }),
          );
        }}
        onPointerDown={startDrag}
        onPointerMove={(event) => {
          const current = drag.current;
          if (current && current.pointer === event.pointerId) {
            setPosition(
              clamp({ top: current.top + event.clientY - current.y, left: current.left + event.clientX - current.x }),
            );
          }
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {children}
      </div>
    );
  },
);
FloatingPanel.displayName = 'FloatingPanel';
