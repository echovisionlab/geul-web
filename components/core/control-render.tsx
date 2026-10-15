import type { ComponentPropsWithRef } from 'react';

/**
 * React Aria filters `title` from DOM props and its Link has no excludeFromTabOrder API.
 * Core command links render through this hook so the accepted native advisory text and
 * tab order reach the element. Like React Aria's default, an unavailable link renders a
 * non-navigating span; a pending link also reports busy.
 */
export function controlLinkRender({
  title,
  tabIndex,
  pending = false,
  disabled = false,
}: {
  title?: string;
  tabIndex?: number;
  pending?: boolean;
  disabled?: boolean;
}) {
  return function renderControlLink(domProps: object) {
    if (pending || disabled) {
      return (
        <span {...(domProps as ComponentPropsWithRef<'span'>)} aria-busy={pending ? 'true' : undefined} title={title} />
      );
    }
    const anchor = domProps as ComponentPropsWithRef<'a'>;
    return <a {...anchor} tabIndex={tabIndex ?? anchor.tabIndex} title={title} />;
  };
}
