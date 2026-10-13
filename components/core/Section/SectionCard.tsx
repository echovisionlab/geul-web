import { forwardRef, type CSSProperties } from 'react';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import {
  isSpace,
  resolveResponsive,
  layoutPoints,
  spaceValue,
  type Space,
  type Responsive,
} from '../Layout/layout-contract';
import classes from './Surface.module.css';

export interface SectionCardProps extends PresentationProps {
  padding?: Responsive<Space>;
  /** Child card in a parent's content track; its own padding/border are compensated. */
  nested?: boolean;
  withBorder?: boolean;
  appearance?: 'surface' | 'muted' | 'plain' | 'paper' | 'overlay';
  border?: 'none' | 'all' | 'block-start' | 'block-end' | 'inline-start' | 'inline-end' | 'block' | 'inline';
  clip?: boolean;
  state?: 'default' | 'dragging' | 'drop-target' | 'disabled';
  stretch?: boolean;
  grow?: boolean;
  layout?: 'block' | 'stack';
}
export const SectionCard = forwardRef<HTMLDivElement, SectionCardProps>(
  (
    {
      padding = 'md',
      nested = false,
      withBorder = false,
      border,
      clip,
      appearance = 'surface',
      state = 'default',
      stretch,
      grow,
      layout = 'block',
      children,
      ...props
    },
    ref,
  ) => (
    <div
      {...presentationAttributes(props)}
      ref={ref}
      className={classes.surface}
      style={
        Object.fromEntries(
          layoutPoints.map((point) => [
            `--_surface-inset-${point}`,
            spaceValue(resolveResponsive(padding, 'md', isSpace, 'SectionCard padding')[point]),
          ]),
        ) as CSSProperties
      }
      data-border={border ?? (withBorder ? 'all' : 'none')}
      data-geul-hierarchy-nested={nested || undefined}
      data-clip={clip || undefined}
      data-appearance={appearance}
      data-state={state}
      data-stretch={stretch || undefined}
      data-grow={grow || undefined}
      data-layout={layout}
    >
      {children}
    </div>
  ),
);
SectionCard.displayName = 'SectionCard';
