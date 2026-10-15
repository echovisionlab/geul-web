'use client';

import {
  Children,
  cloneElement,
  isValidElement,
  type ComponentProps,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Button as AriaButton, Focusable, Pressable } from 'react-aria-components';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { TextButton } from './TextButton';
import { MenuToggle } from './MenuToggle';
import { OverlayTargetRefContext, OverlayTargetPressContext } from './overlay-target-context';

function containsAriaControl(node: ReactNode): boolean {
  return Children.toArray(node).some((child) => {
    if (!isValidElement<{ children?: ReactNode; interaction?: string; href?: string }>(child)) {
      return false;
    }
    // Sensor handles deliberately render native buttons. Their adapter depends on
    // whether this boundary owns a press action or only a focus hint.
    if (child.type === IconButton && child.props.interaction === 'drag-handle' && child.props.href === undefined) {
      return false;
    }
    if ([AriaButton, Button, IconButton, TextButton, MenuToggle].includes(child.type as typeof AriaButton)) {
      return true;
    }
    const name = (child.type as { displayName?: string }).displayName;
    if (name === 'Tooltip' || name === 'DropdownMenu.Target' || name === 'Popover.Target') {
      return true;
    }
    return containsAriaControl(child.props.children);
  });
}

/** Do not install usePress twice on Core controls. Custom DOM triggers get the RAC adapter. */
export function OverlayTriggerTarget({
  children,
  forwardedRef,
  focusOnly = false,
  tabIndex,
}: {
  children: ReactElement;
  forwardedRef?: ForwardedRef<HTMLElement>;
  focusOnly?: boolean;
  tabIndex?: 0 | -1;
}) {
  if ((children.type as { displayName?: string }).displayName === 'Tooltip') {
    return (
      <OverlayTargetPressContext.Provider value={!focusOnly}>
        <OverlayTargetRefContext.Provider value={forwardedRef}>{children}</OverlayTargetRefContext.Provider>
      </OverlayTargetPressContext.Provider>
    );
  }
  if (containsAriaControl(children)) {
    return forwardedRef
      ? cloneElement(children as ReactElement<{ ref?: ForwardedRef<HTMLElement> }>, { ref: forwardedRef })
      : children;
  }
  return focusOnly ? (
    <Focusable ref={forwardedRef} excludeFromTabOrder={tabIndex === -1}>
      {children as ComponentProps<typeof Focusable>['children']}
    </Focusable>
  ) : (
    <Pressable ref={forwardedRef}>{children as ComponentProps<typeof Pressable>['children']}</Pressable>
  );
}
