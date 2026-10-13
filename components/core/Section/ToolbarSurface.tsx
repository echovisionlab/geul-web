'use client';
import { forwardRef, type KeyboardEvent } from 'react';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import { ToolbarDensityProvider, type ToolbarDensity } from '../control-context';
import classes from './ToolbarSurface.module.css';
export interface ToolbarSurfaceProps extends PresentationProps {
  label: string;
  wrap?: 'nowrap' | 'wrap';
  density?: ToolbarDensity;
  width?: 'content' | 'full';
  appearance?: 'floating' | 'embedded' | 'inline';
}
function isVisibleCommand(control: HTMLElement, toolbar: HTMLElement) {
  const visibility = getComputedStyle(control).visibility;
  if (visibility === 'hidden' || visibility === 'collapse') {
    return false;
  }
  for (let element: HTMLElement | null = control; element; element = element.parentElement) {
    if (getComputedStyle(element).display === 'none') {
      return false;
    }
    if (element === toolbar) {
      break;
    }
  }
  return true;
}
function moveToolbarFocus(event: KeyboardEvent<HTMLDivElement>) {
  const target = event.target as HTMLElement;
  if (target.closest('[role="toolbar"]') !== event.currentTarget || target.matches('input, textarea, select')) {
    return;
  }
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    return;
  }
  const controls = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], [role="button"]'),
  ).filter(
    (control) =>
      !control.matches(':disabled') &&
      control.getAttribute('aria-disabled') !== 'true' &&
      !control.closest('[hidden], [inert], [aria-hidden="true"]') &&
      control.closest('[role="toolbar"]') === event.currentTarget &&
      isVisibleCommand(control, event.currentTarget),
  );
  const index = controls.indexOf(target.closest('button, a[href], [role="button"]') as HTMLElement);
  if (index < 0 || !controls.length) {
    return;
  }
  const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
  const step = (event.key === 'ArrowRight' ? 1 : -1) * (rtl ? -1 : 1);
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? controls.length - 1
        : (index + step + controls.length) % controls.length;
  event.preventDefault();
  controls[next].focus();
}
/** Shared contextual toolbar chrome and control density. Feature commands cannot override its controls. */
export const ToolbarSurface = forwardRef<HTMLDivElement, ToolbarSurfaceProps>(
  (
    {
      label,
      children,
      wrap = 'wrap',
      density = 'comfortable',
      width = 'content',
      appearance = 'floating',
      onKeyDown,
      ...props
    },
    ref,
  ) => (
    <ToolbarDensityProvider density={density}>
      <div
        {...presentationAttributes(props)}
        ref={ref}
        className={classes.toolbar}
        role="toolbar"
        aria-label={label}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented) {
            moveToolbarFocus(event);
          }
        }}
        data-geul-toolbar-wrap={wrap}
        data-geul-toolbar-density={density}
        data-geul-toolbar-width={width}
        data-geul-toolbar-appearance={appearance}
      >
        {children}
      </div>
    </ToolbarDensityProvider>
  ),
);
ToolbarSurface.displayName = 'ToolbarSurface';
