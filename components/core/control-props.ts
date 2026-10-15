import type { AriaAttributes, DOMAttributes, MouseEvent, MouseEventHandler, ReactNode } from 'react';
import type { ButtonProps as AriaButtonProps } from 'react-aria-components';
import { isCoreOwnedAttribute, type ClosedVisualProps } from './visual-contract';

/** Semantic DOM affordances only. Visual ownership stays inside Core. */
export interface ControlNativeProps
  extends AriaAttributes, ClosedVisualProps, Omit<DOMAttributes<HTMLElement>, 'children' | 'dangerouslySetInnerHTML'> {
  id?: string;
  title?: string;
  role?: string;
  tabIndex?: number;
  autoFocus?: boolean;
  draggable?: boolean;
  hidden?: boolean;
  'data-active'?: never;
  'data-selected'?: never;
  'data-disabled'?: never;
  'data-pending'?: never;
  'data-hovered'?: never;
  'data-pressed'?: never;
  'data-focus-visible'?: never;
  'data-focused'?: never;
  [dataAttribute: `data-${string}`]: string | number | boolean | undefined;
}

export interface ControlContentProps {
  children?: ReactNode;
  leftSection?: ReactNode;
  rightSection?: ReactNode;
  fullWidth?: boolean;
  justify?: 'start' | 'center' | 'between';
  printVisibility?: 'normal' | 'hidden';
}

const nativeKeys = new Set(['id', 'title', 'role', 'tabIndex', 'autoFocus', 'draggable', 'hidden']);

/** Never spread caller styling or unknown props onto the implementation root. */
export function controlNativeProps(props: ControlNativeProps) {
  return Object.fromEntries(
    Object.entries(props).filter(
      ([key]) =>
        nativeKeys.has(key) ||
        key.startsWith('aria-') ||
        (key.startsWith('data-') && !isCoreOwnedAttribute(key)) ||
        /^on[A-Z]/.test(key),
    ),
  );
}

export function ariaControlClick(handler?: MouseEventHandler<HTMLElement>): AriaButtonProps['onClick'] {
  if (!handler) {
    return undefined;
  }
  return (event) => {
    if (event.currentTarget instanceof HTMLElement) {
      handler(event as MouseEvent<HTMLElement>);
    }
  };
}
