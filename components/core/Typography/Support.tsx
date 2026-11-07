'use client';

import { createContext, createElement, forwardRef, useContext, type ReactNode, type CSSProperties } from 'react';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import { spaceValue, type Space } from '../Layout/layout-contract';
import { primitiveTokens } from '@echovisionlab/design-system/tokens';
import type { TextSize } from './Typography';
import classes from './Support.module.css';

export interface CodeProps extends PresentationProps {
  block?: boolean;
  wrap?: 'preserve' | 'anywhere';
  selectable?: 'text' | 'all';
  scroll?: 'standard' | 'large';
}
export const Code = forwardRef<HTMLElement, CodeProps>(
  ({ children, block, wrap = 'preserve', selectable = 'text', scroll, ...props }, ref) => {
    const Element = block ? 'pre' : 'code';
    return (
      <Element
        {...presentationAttributes(props)}
        ref={ref as never}
        className={classes.code}
        data-block={block || undefined}
        data-wrap={wrap}
        data-selectable={selectable}
        data-scroll={scroll}
        style={
          scroll
            ? ({
                '--_code-scroll-limit':
                  scroll === 'standard'
                    ? `calc(${primitiveTokens.breakpoints.sm} / 2)`
                    : primitiveTokens.breakpoints.sm,
              } as CSSProperties)
            : undefined
        }
      >
        {children}
      </Element>
    );
  },
);
Code.displayName = 'Code';

const ListIconContext = createContext<ReactNode>(null);
export interface ListProps extends PresentationProps {
  ordered?: boolean;
  size?: Exclude<TextSize, 'display'>;
  spacing?: Space;
  icon?: ReactNode;
  /**
   * `interface` (default) pairs the line height with the size role. `document` is running text in a
   * long document body (for example changelog release notes): the shared `line-height-document` role
   * that published `.prose` and the editor body use, at any size.
   */
  leading?: 'interface' | 'document';
}
export function List({
  children,
  ordered = false,
  size = 'sm',
  spacing = 'xs',
  icon,
  leading = 'interface',
  ...props
}: ListProps) {
  const Element = ordered ? 'ol' : 'ul';
  return (
    <ListIconContext.Provider value={icon}>
      <Element
        {...presentationAttributes(props)}
        className={classes.list}
        data-size={size}
        data-leading={leading === 'document' ? leading : undefined}
        data-icons={icon ? true : undefined}
        style={{ '--_list-gap': spaceValue(spacing) } as CSSProperties}
      >
        {children}
      </Element>
    </ListIconContext.Provider>
  );
}
export const ListItem = forwardRef<HTMLLIElement, PresentationProps>(({ children, ...props }, ref) => {
  const icon = useContext(ListIconContext);
  return (
    <li {...presentationAttributes(props)} ref={ref} className={classes.item}>
      {icon ? (
        <>
          <span className={classes.icon} aria-hidden>
            {icon}
          </span>
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </li>
  );
});
ListItem.displayName = 'ListItem';
List.Item = ListItem;

export interface VisuallyHiddenProps extends PresentationProps {
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}
export const VisuallyHidden = forwardRef<HTMLElement, VisuallyHiddenProps>(({ children, as = 'span', ...props }, ref) =>
  createElement(as, { ...presentationAttributes(props), ref, className: classes.visuallyHidden }, children),
);
VisuallyHidden.displayName = 'VisuallyHidden';
