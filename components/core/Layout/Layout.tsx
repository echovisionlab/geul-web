'use client';

import {
  createContext,
  createElement,
  forwardRef,
  useContext,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { primitiveTokens } from '@echovisionlab/design-system/tokens';
import {
  isColumnCount,
  isColumnOffset,
  isMinColumnWidth,
  isColumnSpan,
  isSpace,
  layoutPoints,
  projectLayoutAttributes,
  resolveElement,
  resolveResponsive,
  responsiveVariables,
  spaceValue,
  type LayoutAlign,
  type LayoutColumnCount,
  type LayoutMinColumnWidth,
  type LayoutColumnOffset,
  type LayoutColumnSpan,
  type LayoutContainerSize,
  type LayoutElement,
  type LayoutNativeProps,
  type LayoutPoint,
  type Responsive,
  type Space,
} from './layout-contract';
import classes from './Layout.module.css';

interface LayoutBaseProps extends LayoutNativeProps {
  children?: ReactNode;
  as?: LayoutElement;
  flexible?: boolean;
  fill?: 'inline' | 'block' | 'both';
  shrink?: boolean;
  clip?: boolean;
  textAlign?: 'start' | 'center' | 'end';
  order?: 0 | 1 | 2 | 3 | 4;
}
export interface LayoutStackProps extends LayoutBaseProps {
  gap?: Responsive<Space>;
  align?: LayoutAlign;
  justify?: Responsive<'start' | 'center' | 'end' | 'between' | 'around'>;
  printFlow?: 'row' | 'stack';
}
export interface LayoutInlineProps extends LayoutStackProps {
  justify?: Responsive<'start' | 'center' | 'end' | 'between' | 'around'>;
  printFlow?: 'row' | 'stack';
  wrap?: Responsive<'wrap' | 'nowrap'>;
  direction?: Responsive<'row' | 'column'>;
  grow?: boolean;
}
export interface LayoutInsetProps extends LayoutBaseProps {
  space?: Responsive<Space>;
  block?: Responsive<Space>;
  inline?: Responsive<Space>;
  blockStart?: Responsive<Space>;
  blockEnd?: Responsive<Space>;
  inlineStart?: Responsive<Space>;
  inlineEnd?: Responsive<Space>;
}
export interface LayoutSpacerProps extends Omit<LayoutNativeProps, 'role' | 'tabIndex'> {
  size?: Responsive<Space>;
  axis?: 'block' | 'inline';
  flexible?: boolean;
  children?: never;
  as?: never;
}
export interface LayoutContainerProps extends LayoutBaseProps {
  size?: LayoutContainerSize;
  inset?: Responsive<Space>;
  /** `center` (default) centers the measure in the available width; `start` keeps it on the start edge. */
  placement?: 'center' | 'start';
}
export interface LayoutGridProps extends Omit<LayoutStackProps, 'justify'> {
  columns?: Responsive<LayoutColumnCount>;
  /**
   * A fluid grid: as many equal columns as fit, each at least this wide (never wider than the grid).
   * Replaces `columns`; items take one track each, so `LayoutGridItem` spans do not apply.
   */
  minColumnWidth?: Responsive<LayoutMinColumnWidth>;
  /**
   * With `minColumnWidth`: `fill` (default) stretches the columns to fill each row; `none` keeps every
   * column at its minimum width and leaves the spare space at the row end, so items keep one exact scale.
   */
  columnGrowth?: Responsive<'fill' | 'none'>;
  rowGap?: Responsive<Space>;
  columnGap?: Responsive<Space>;
  rows?: 'content' | 'stretch';
}
export interface LayoutGridItemProps extends LayoutBaseProps {
  span?: Responsive<LayoutColumnSpan>;
  offset?: Responsive<LayoutColumnOffset>;
}
const StructuralElement = forwardRef<HTMLElement, HTMLAttributes<HTMLElement> & { element: LayoutElement }>(
  ({ element, ...props }, ref) => createElement(element, { ...props, ref }),
);
StructuralElement.displayName = 'CoreLayoutElement';

const GridContext = createContext<Record<LayoutPoint, LayoutColumnCount> | null>(null);
const alignValues = ['start', 'center', 'end', 'stretch', 'baseline'] as const;
const justifyValues = ['start', 'center', 'end', 'between', 'around'] as const;
function validChoice(value: string, options: readonly string[], name: string) {
  if (!options.includes(value)) {
    throw new RangeError(`Core Layout ${name} must use a supported value`);
  }
  return value;
}
function validBoolean(value: boolean, name: string) {
  if (typeof value !== 'boolean') {
    throw new RangeError(`Core Layout ${name} must be boolean`);
  }
  return value;
}
function layoutBehavior({
  flexible,
  fill,
  shrink,
  clip,
  textAlign,
  order,
}: Pick<LayoutBaseProps, 'flexible' | 'fill' | 'shrink' | 'textAlign' | 'order' | 'clip'>) {
  if (order !== undefined && (!Number.isInteger(order) || order < 0 || order > 4)) {
    throw new RangeError('Core Layout order must be an integer from 0 through 4');
  }
  return {
    'data-geul-layout-text-align':
      textAlign === undefined ? undefined : validChoice(textAlign, ['start', 'center', 'end'], 'text align'),
    'data-geul-layout-order': order,
    'data-geul-layout-clip': clip === undefined ? undefined : validBoolean(clip, 'clip') || undefined,
    'data-geul-layout-flexible': flexible === undefined ? undefined : validBoolean(flexible, 'flexible') || undefined,
    'data-geul-layout-fill': fill === undefined ? undefined : validChoice(fill, ['inline', 'block', 'both'], 'fill'),
    'data-geul-layout-shrink': shrink === undefined ? undefined : String(validBoolean(shrink, 'shrink')),
  };
}
const alignmentCss: Record<string, string> = {
  start: 'flex-start',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
};
function choiceVariables<T extends string>(
  name: string,
  value: Responsive<T> | undefined,
  fallback: T,
  choices: readonly T[],
) {
  return responsiveVariables(
    name,
    resolveResponsive(
      value,
      fallback,
      (entry): entry is T => typeof entry === 'string' && choices.includes(entry as T),
      name,
    ),
    (entry) => alignmentCss[entry] ?? entry,
  );
}
function baseChoice<T extends string>(value: Responsive<T> | undefined, fallback: T, choices: readonly T[]) {
  return resolveResponsive(
    value,
    fallback,
    (entry): entry is T => typeof entry === 'string' && choices.includes(entry as T),
    'choice',
  ).base;
}
function spacing(name: string, value: Responsive<Space> | undefined, fallback: Space) {
  return responsiveVariables(name, resolveResponsive(value, fallback, isSpace, name), spaceValue);
}

export const LayoutStack = forwardRef<HTMLElement, LayoutStackProps>(
  (
    {
      as,
      children,
      gap,
      align = 'stretch',
      justify = 'start',
      printFlow,
      flexible,
      fill,
      shrink,
      clip,
      textAlign,
      order,
      ...props
    },
    ref,
  ) => {
    const Element = resolveElement(as);
    return (
      <StructuralElement
        element={Element}
        {...projectLayoutAttributes(props)}
        {...layoutBehavior({ flexible, fill, shrink, clip, textAlign, order })}
        ref={ref}
        className={`${classes.root} ${classes.stack}`}
        style={
          {
            ...spacing('gap', gap, 'md'),
            ...choiceVariables('justify', justify, 'start', justifyValues),
          } as CSSProperties
        }
        data-geul-layout="stack"
        data-geul-layout-print-flow={
          printFlow === undefined ? undefined : validChoice(printFlow, ['row', 'stack'], 'print flow')
        }
        data-geul-layout-justify={baseChoice(justify, 'start', justifyValues)}
        data-geul-layout-align={validChoice(align, alignValues, 'align')}
      >
        {children}
      </StructuralElement>
    );
  },
);
LayoutStack.displayName = 'LayoutStack';

export const LayoutInline = forwardRef<HTMLElement, LayoutInlineProps>(
  (
    {
      as,
      children,
      gap,
      align = 'center',
      justify = 'start',
      wrap = 'wrap',
      direction = 'row',
      printFlow,
      grow = false,
      flexible,
      fill,
      shrink,
      clip,
      textAlign,
      order,
      ...props
    },
    ref,
  ) => {
    const Element = resolveElement(as);
    return (
      <StructuralElement
        element={Element}
        {...projectLayoutAttributes(props)}
        {...layoutBehavior({ flexible, fill, shrink, clip, textAlign, order })}
        ref={ref}
        className={`${classes.root} ${classes.inline}`}
        style={
          {
            ...spacing('gap', gap, 'md'),
            ...choiceVariables('justify', justify, 'start', justifyValues),
            ...choiceVariables('wrap', wrap, 'wrap', ['wrap', 'nowrap']),
            ...choiceVariables('direction', direction, 'row', ['row', 'column']),
          } as CSSProperties
        }
        data-geul-layout="inline"
        data-geul-layout-align={validChoice(align, alignValues, 'align')}
        data-geul-layout-justify={baseChoice(justify, 'start', justifyValues)}
        data-geul-layout-wrap={baseChoice(wrap, 'wrap', ['wrap', 'nowrap'])}
        data-geul-layout-print-flow={
          printFlow === undefined ? undefined : validChoice(printFlow, ['row', 'stack'], 'print flow')
        }
        data-geul-layout-grow={validBoolean(grow, 'grow') || undefined}
      >
        {children}
      </StructuralElement>
    );
  },
);
LayoutInline.displayName = 'LayoutInline';

export const LayoutInset = forwardRef<HTMLElement, LayoutInsetProps>(
  (
    {
      as,
      children,
      space,
      block,
      inline,
      blockStart,
      blockEnd,
      inlineStart,
      inlineEnd,
      flexible,
      fill,
      shrink,
      clip,
      textAlign,
      order,
      ...props
    },
    ref,
  ) => {
    const Element = resolveElement(as);
    const resolvedSpace =
      space ??
      ([block, inline, blockStart, blockEnd, inlineStart, inlineEnd].some((value) => value !== undefined)
        ? 'none'
        : 'md');
    return (
      <StructuralElement
        element={Element}
        {...projectLayoutAttributes(props)}
        {...layoutBehavior({ flexible, fill, shrink, clip, textAlign, order })}
        ref={ref}
        className={`${classes.root} ${classes.inset}`}
        style={
          {
            ...spacing('inset-block', block ?? resolvedSpace, 'md'),
            ...spacing('inset-inline', inline ?? resolvedSpace, 'md'),
            ...spacing('inset-block-start', blockStart ?? block ?? resolvedSpace, 'md'),
            ...spacing('inset-block-end', blockEnd ?? block ?? resolvedSpace, 'md'),
            ...spacing('inset-inline-start', inlineStart ?? inline ?? resolvedSpace, 'md'),
            ...spacing('inset-inline-end', inlineEnd ?? inline ?? resolvedSpace, 'md'),
          } as CSSProperties
        }
        data-geul-layout="inset"
      >
        {children}
      </StructuralElement>
    );
  },
);
LayoutInset.displayName = 'LayoutInset';

export const LayoutSpacer = forwardRef<HTMLSpanElement, LayoutSpacerProps>(
  ({ size, axis = 'block', flexible = false, ...props }, ref) => (
    <span
      {...projectLayoutAttributes(props)}
      ref={ref}
      className={`${classes.root} ${classes.spacer}`}
      style={spacing('space', size, 'md') as CSSProperties}
      data-geul-layout="spacer"
      aria-hidden="true"
      data-geul-layout-axis={validChoice(axis, ['block', 'inline'], 'axis')}
      data-geul-layout-flexible={validBoolean(flexible, 'flexible') || undefined}
    />
  ),
);
LayoutSpacer.displayName = 'LayoutSpacer';

const containerWidths: Record<LayoutContainerSize, string> = {
  form: primitiveTokens.contentWidth.form,
  reading: primitiveTokens.contentWidth.reading,
  compact: primitiveTokens.contentWidth.compact,
  standard: primitiveTokens.contentWidth.standard,
  wide: primitiveTokens.contentWidth.wide,
  full: '100%',
};
export const LayoutContainer = forwardRef<HTMLElement, LayoutContainerProps>(
  (
    {
      as,
      children,
      size = 'standard',
      inset,
      placement = 'center',
      flexible,
      fill,
      shrink,
      clip,
      textAlign,
      order,
      ...props
    },
    ref,
  ) => {
    const Element = resolveElement(as);
    validChoice(size, Object.keys(containerWidths), 'container size');
    validChoice(placement, ['center', 'start'], 'container placement');
    return (
      <StructuralElement
        element={Element}
        {...projectLayoutAttributes(props)}
        {...layoutBehavior({ flexible, fill, shrink, clip, textAlign, order })}
        ref={ref}
        className={`${classes.root} ${classes.container}`}
        style={
          {
            ...spacing('inset-inline', inset, 'md'),
            '--_layout-container-width': containerWidths[size],
          } as CSSProperties
        }
        data-geul-layout="container"
        data-geul-layout-size={size}
        data-geul-layout-placement={placement === 'start' ? 'start' : undefined}
      >
        {children}
      </StructuralElement>
    );
  },
);
LayoutContainer.displayName = 'LayoutContainer';

const isColumnGrowth = (value: unknown): value is 'fill' | 'none' => value === 'fill' || value === 'none';

export const LayoutGrid = forwardRef<HTMLElement, LayoutGridProps>(
  (
    {
      as,
      children,
      columns,
      minColumnWidth,
      columnGrowth,
      gap,
      rowGap,
      columnGap,
      rows = 'content',
      align = 'start',
      printFlow,
      flexible,
      fill,
      shrink,
      clip,
      textAlign,
      order,
      ...props
    },
    ref,
  ) => {
    const Element = resolveElement(as);
    const resolvedColumns = resolveResponsive(columns, 1, isColumnCount, 'columns');
    const minColumns =
      minColumnWidth === undefined
        ? undefined
        : resolveResponsive(minColumnWidth, 'md', isMinColumnWidth, 'grid minimum column width');
    const growth = resolveResponsive(columnGrowth, 'fill', isColumnGrowth, 'grid column growth');
    return (
      <GridContext.Provider value={resolvedColumns}>
        <StructuralElement
          element={Element}
          {...projectLayoutAttributes(props)}
          {...layoutBehavior({ flexible, fill, shrink, clip, textAlign, order })}
          ref={ref}
          className={`${classes.root} ${classes.grid}`}
          style={
            {
              ...responsiveVariables('columns', resolvedColumns),
              ...(minColumns
                ? {
                    ...responsiveVariables('min-column', minColumns, (width) => `var(--_layout-track-${width})`),
                    ...Object.fromEntries(
                      layoutPoints.map((point) => [
                        `--_layout-column-max-${point}`,
                        growth[point] === 'none' ? `var(--_layout-track-${minColumns[point]})` : '1fr',
                      ]),
                    ),
                  }
                : {}),
              ...spacing('row-gap', rowGap ?? gap, 'md'),
              ...spacing('column-gap', columnGap ?? gap, 'md'),
            } as CSSProperties
          }
          data-geul-layout="grid"
          data-geul-layout-rows={validChoice(rows, ['content', 'stretch'], 'grid rows')}
          data-geul-layout-min-column={minColumns ? '' : undefined}
          data-geul-layout-align={validChoice(align, alignValues, 'align')}
        >
          {children}
        </StructuralElement>
      </GridContext.Provider>
    );
  },
);
LayoutGrid.displayName = 'LayoutGrid';

export const LayoutGridItem = forwardRef<HTMLElement, LayoutGridItemProps>(
  ({ as, children, span, offset, flexible, fill, shrink, clip, textAlign, order, ...props }, ref) => {
    const Element = resolveElement(as);
    const columns = useContext(GridContext);
    if (!columns) {
      throw new Error('LayoutGridItem must be rendered inside LayoutGrid');
    }
    const spans = resolveResponsive(span, 1, isColumnSpan, 'span');
    const offsets = resolveResponsive(offset, 0, isColumnOffset, 'offset');
    const widths = Object.fromEntries(
      layoutPoints.map((point) => {
        const width = spans[point] === 'full' ? columns[point] : spans[point];
        if (width + offsets[point] > columns[point]) {
          throw new RangeError(`LayoutGridItem span and offset exceed its parent columns at ${point}`);
        }
        return [point, width];
      }),
    ) as Record<LayoutPoint, number>;
    return (
      <StructuralElement
        element={Element}
        {...projectLayoutAttributes(props)}
        {...layoutBehavior({ flexible, fill, shrink, clip, textAlign, order })}
        ref={ref}
        className={`${classes.root} ${classes.gridItem}`}
        style={
          {
            ...responsiveVariables('span', widths),
            ...responsiveVariables('start', offsets, (value) => (value === 0 ? 'auto' : String(value + 1))),
          } as CSSProperties
        }
        data-geul-layout="grid-item"
      >
        {children}
      </StructuralElement>
    );
  },
);
LayoutGridItem.displayName = 'LayoutGridItem';
