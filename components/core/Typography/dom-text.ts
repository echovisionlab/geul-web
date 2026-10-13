import type { TextProps } from './Typography';
import classes from './Typography.module.css';
import supportClasses from './Support.module.css';

/** Keeps native hydrated announcements in the same hidden presentation as Core VisuallyHidden. */
export function applyVisuallyHiddenPresentation(element: HTMLElement) {
  element.classList.add(supportClasses.visuallyHidden);
  return element;
}

/** Native hydration uses the same finite typography contract as React Text. */
export type DomTextPresentation = Pick<
  TextProps,
  | 'size'
  | 'weight'
  | 'tone'
  | 'align'
  | 'font'
  | 'truncate'
  | 'style'
  | 'styles'
  | 'className'
  | 'classNames'
  | 'vars'
  | 'color'
  | 'c'
  | 'radius'
  | 'unstyled'
>;
export function applyTextPresentation(
  element: HTMLElement,
  {
    size = 'md',
    weight = 'regular',
    tone = 'primary',
    align = 'inherit',
    font = 'ui',
    truncate,
  }: DomTextPresentation = {},
) {
  element.classList.add(classes.text);
  element.dataset.size = size;
  element.dataset.weight = weight;
  element.dataset.tone = tone;
  element.dataset.align = align;
  element.dataset.font = font;
  if (truncate) {
    element.dataset.truncate = 'true';
  } else {
    delete element.dataset.truncate;
  }
  return element;
}
