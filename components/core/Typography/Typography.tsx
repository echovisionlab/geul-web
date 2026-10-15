import { createElement, forwardRef } from 'react';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import type { ControlTone } from '../control-style';
import classes from './Typography.module.css';
import { resolveResponsive, type Responsive } from '../Layout/layout-contract';

export type TextSize = 'display' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type TextWeight = 'regular' | 'medium' | 'strong';
export type TextTone = ControlTone | 'primary' | 'secondary' | 'muted' | 'inverse' | 'inverse-secondary' | 'inherit';
export interface TextProps extends PresentationProps {
  as?: 'div' | 'span' | 'p' | 'label' | 'strong' | 'em' | 'dt' | 'dd' | 'output' | 'figcaption' | 'li';
  contrast?: 'default' | 'image';
  flexible?: boolean;
  shrink?: boolean;
  fill?: 'inline' | 'block' | 'both';
  italic?: boolean;
  casing?: 'normal' | 'uppercase';
  size?: TextSize;
  weight?: TextWeight;
  tone?: TextTone;
  align?: 'start' | 'center' | 'end' | 'inherit';
  font?: 'ui' | 'mono';
  truncate?: boolean;
  wrap?: 'normal' | 'anywhere' | 'preserve';
  nowrap?: boolean;
  numeric?: 'normal' | 'tabular';
  lines?: 1 | 2 | 3 | 4 | 5 | 6;
  htmlFor?: string;
}

export const Text = forwardRef<HTMLElement, TextProps>(
  (
    {
      as = 'div',
      contrast = 'default',
      flexible,
      shrink,
      fill,
      italic,
      casing,
      size = 'md',
      weight = 'regular',
      tone = 'primary',
      align = 'inherit',
      font = 'ui',
      truncate,
      lines,
      wrap,
      nowrap,
      numeric,
      htmlFor,
      children,
      ...props
    },
    ref,
  ) =>
    createElement(
      as,
      {
        ...presentationAttributes(props),
        ref,
        'data-contrast': contrast,
        className: classes.text,
        'data-core-typography': 'text',
        'data-flexible': flexible || undefined,
        'data-shrink': shrink,
        'data-fill': fill,
        'data-italic': italic || undefined,
        'data-casing': casing,
        'data-size': size,
        'data-weight': weight,
        'data-tone': tone,
        'data-align': align,
        'data-font': font,
        'data-truncate': truncate || undefined,
        'data-lines': lines,
        'data-wrap': wrap,
        'data-nowrap': nowrap || undefined,
        'data-numeric': numeric,
        htmlFor: as === 'label' ? htmlFor : undefined,
      },
      children,
    ),
);
Text.displayName = 'Text';

/**
 * Visual heading roles. `title` is the document title (Post, Page and public document details): one
 * clear step above an authored body `h1` at every width and on paper. 1–6 are the section steps.
 * Each role is responsive in the token layer; a responsive object only changes the role per breakpoint.
 */
export type HeadingScale = 'title' | 1 | 2 | 3 | 4 | 5 | 6;
const headingScaleTokens: Record<HeadingScale, string> = {
  title: 'var(--geul-heading-title)',
  1: 'var(--geul-heading-h1)',
  2: 'var(--geul-heading-h2)',
  3: 'var(--geul-heading-h3)',
  4: 'var(--geul-heading-h4)',
  5: 'var(--geul-heading-h5)',
  6: 'var(--geul-heading-h6)',
};
export interface HeadingProps extends PresentationProps {
  lines?: 1 | 2 | 3 | 4 | 5 | 6;
  contrast?: 'default' | 'image';
  flexible?: boolean;
  truncate?: boolean;
  tone?: TextTone;
  wrap?: 'normal' | 'anywhere';
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  scale?: Responsive<HeadingScale>;
  align?: 'start' | 'center' | 'end';
}
export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(
  (
    {
      contrast = 'default',
      level = 2,
      scale = level,
      align = 'start',
      tone = 'primary',
      flexible,
      truncate,
      lines,
      wrap,
      children,
      ...props
    },
    ref,
  ) =>
    createElement(
      `h${level}`,
      {
        ...presentationAttributes(props),
        ref,
        'data-contrast': contrast,
        className: classes.heading,
        'data-core-typography': 'heading',
        'data-tone': tone,
        'data-lines': lines,
        'data-flexible': flexible || undefined,
        'data-truncate': truncate || undefined,
        'data-wrap': wrap,
        'data-level': resolveHeadingScale(scale, level).base,
        style: Object.fromEntries(
          Object.entries(resolveHeadingScale(scale, level)).map(([point, value]) => [
            `--_typography-heading-scale-${point}`,
            headingScaleTokens[value],
          ]),
        ),
        'data-align': align,
      },
      children,
    ),
);
function resolveHeadingScale(value: Responsive<HeadingScale>, fallback: HeadingScale) {
  return resolveResponsive(
    value,
    fallback,
    (entry): entry is HeadingScale =>
      entry === 'title' || (typeof entry === 'number' && Number.isInteger(entry) && entry >= 1 && entry <= 6),
    'heading scale',
  );
}
Heading.displayName = 'Heading';
