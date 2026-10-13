'use client';
import { ToolbarDensityProvider } from '../control-context';
import { forwardRef, useState, type CSSProperties, type ReactNode } from 'react';
import { IconUser } from '@tabler/icons-react';
import { nativeProps, type DisplayNativeProps, type DisplaySize } from './display-native-props';
import { avatarInitial } from './avatar-initial';
import classes from './Display.module.css';
import spinnerClasses from '../Spinner.module.css';

export type { DisplaySize } from './display-native-props';
export type AvatarSize = DisplaySize | 'profile';
export interface AvatarProps extends DisplayNativeProps {
  src?: string | null;
  alt?: string;
  children?: ReactNode;
  size?: AvatarSize;
  shape?: 'circle' | 'square';
  tone?: 'neutral' | 'inherit';
  interactive?: boolean;
  /**
   * Display name used for the fallback initial when no image renders. Core derives one
   * uppercase grapheme and falls back to the shared person glyph for a blank name.
   * It does not name the avatar; use alt when the avatar itself carries identity.
   */
  name?: string | null;
}
export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  (
    { src, alt, children, name, size = 'md', shape = 'circle', tone = 'neutral', interactive = false, ...props },
    ref,
  ) => {
    const [failedSource, setFailedSource] = useState<string | null>(null);
    if (name !== undefined && children !== undefined) {
      throw new TypeError('Core Avatar derives its fallback from name; do not also pass children');
    }
    const initial = name === undefined ? null : avatarInitial(name);
    return (
      <span
        {...nativeProps(props)}
        ref={ref}
        className={classes.avatar}
        data-size={size}
        data-shape={shape}
        data-tone={tone}
        data-interactive={interactive || undefined}
        role={alt ? 'img' : undefined}
        aria-label={alt}
      >
        {src && failedSource !== src ? (
          <img src={src} alt="" onError={() => setFailedSource(src)} />
        ) : (
          (children ??
          (initial ? (
            <span aria-hidden data-avatar-initial="">
              {initial}
            </span>
          ) : (
            <IconUser size="1em" aria-hidden />
          )))
        )}
      </span>
    );
  },
);
Avatar.displayName = 'Avatar';
export interface SpinnerProps extends DisplayNativeProps {
  size?: DisplaySize;
  tone?: 'neutral' | 'inherit' | 'accent' | 'danger' | 'warning' | 'positive';
}
export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(({ size = 'sm', tone = 'neutral', ...props }, ref) => (
  <span
    {...nativeProps(props)}
    ref={ref}
    className={`${spinnerClasses.spinner} ${classes.spinner}`}
    data-size={size}
    data-tone={tone}
    role={props['aria-label'] ? 'status' : undefined}
    aria-hidden={props['aria-label'] ? undefined : true}
  />
));
Spinner.displayName = 'Spinner';
export interface SeparatorProps extends DisplayNativeProps {
  label?: ReactNode;
  labelPosition?: 'start' | 'center' | 'end';
  orientation?: 'horizontal' | 'vertical';
  spaceBefore?: 'none' | DisplaySize;
  spaceAfter?: 'none' | DisplaySize;
  printVisibility?: 'normal' | 'hidden';
}
export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(
  (
    {
      label,
      labelPosition = 'center',
      orientation = 'horizontal',
      spaceBefore = 'none',
      spaceAfter = 'none',
      printVisibility = 'normal',
      ...props
    },
    ref,
  ) => (
    <div
      {...nativeProps(props)}
      ref={ref}
      className={classes.separator}
      role="separator"
      aria-orientation={orientation}
      data-orientation={orientation}
      data-label-position={labelPosition}
      data-space-before={spaceBefore}
      data-space-after={spaceAfter}
      data-print-visibility={printVisibility}
    >
      {label ? <span>{label}</span> : null}
    </div>
  ),
);
Separator.displayName = 'Separator';
export interface SkeletonProps extends DisplayNativeProps {
  roleType?: 'text' | 'heading' | 'icon' | 'avatar' | 'field' | 'media' | 'fill';
  width?: 'full' | 'short' | 'medium' | 'long';
  shape?: 'square' | 'circle';
}
export const Skeleton = forwardRef<HTMLSpanElement, SkeletonProps>(
  ({ roleType = 'text', width = 'full', shape = 'square', ...props }, ref) => (
    <span
      {...nativeProps(props)}
      ref={ref}
      className={classes.skeleton}
      aria-hidden="true"
      data-role={roleType}
      data-width={width}
      data-shape={shape}
    />
  ),
);
Skeleton.displayName = 'Skeleton';
export interface ScrollAreaProps extends DisplayNativeProps {
  children?: ReactNode;
  size?: 'content' | 'compact' | 'standard' | 'large' | 'fill' | 'viewport';
  limit?: 'compact' | 'standard' | 'large';
  grow?: boolean;
  inset?: 'none' | DisplaySize;
  scrollbars?: 'x' | 'y' | 'both';
}
const ScrollAreaRoot = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ children, size = 'content', limit, grow = false, inset = 'none', scrollbars = 'both', ...props }, ref) => (
    <div
      {...nativeProps(props)}
      ref={ref}
      className={classes.scrollArea}
      data-size={size}
      data-limit={limit}
      data-grow={grow || undefined}
      data-inset={inset}
      data-scrollbars={scrollbars}
      tabIndex={props.tabIndex ?? 0}
    >
      {children}
    </div>
  ),
);
ScrollAreaRoot.displayName = 'ScrollArea';
const ScrollAreaAutosize = forwardRef<HTMLDivElement, ScrollAreaProps>(({ size = 'large', ...props }, ref) => (
  <ScrollAreaRoot
    {...props}
    ref={ref}
    size="content"
    limit={size === 'compact' || size === 'standard' || size === 'large' ? size : 'large'}
  />
));
ScrollAreaAutosize.displayName = 'ScrollArea.Autosize';
export const ScrollArea = Object.assign(ScrollAreaRoot, { Autosize: ScrollAreaAutosize });
export interface TableProps extends DisplayNativeProps {
  children?: ReactNode;
  highlightOnHover?: boolean;
  striped?: boolean;
  bordered?: boolean;
  density?: 'compact' | 'standard' | 'comfortable';
  rowDividers?: 'all' | 'between';
  minWidth?: CSSProperties['minWidth'];
}
const TableRoot = forwardRef<HTMLTableElement, TableProps>(
  (
    {
      children,
      highlightOnHover = false,
      striped = false,
      bordered = false,
      density = 'standard',
      rowDividers = 'all',
      minWidth,
      ...props
    },
    ref,
  ) => {
    if (rowDividers !== 'all' && rowDividers !== 'between') {
      throw new RangeError('Invalid table row dividers');
    }
    return (
      <table
        {...nativeProps(props)}
        ref={ref}
        className={classes.table}
        style={{ minWidth }}
        data-highlight={highlightOnHover || undefined}
        data-striped={striped || undefined}
        data-bordered={bordered || undefined}
        data-density={density}
        data-row-dividers={rowDividers}
      >
        {children}
      </table>
    );
  },
);
TableRoot.displayName = 'Table';
interface TableSectionProps extends DisplayNativeProps {
  children?: ReactNode;
}
const Thead = forwardRef<HTMLTableSectionElement, TableSectionProps>(({ children, ...props }, ref) => (
  <thead {...nativeProps(props)} ref={ref}>
    {children}
  </thead>
));
const Tbody = forwardRef<HTMLTableSectionElement, TableSectionProps>(({ children, ...props }, ref) => (
  <tbody {...nativeProps(props)} ref={ref}>
    {children}
  </tbody>
));
export interface TableRowProps extends TableSectionProps {
  dragState?: { transform?: string; transition?: string; dragging?: boolean };
  interactive?: boolean;
  selected?: boolean;
  disabled?: boolean;
  dimmed?: boolean;
  preventTextSelection?: boolean;
}
const Tr = forwardRef<HTMLTableRowElement, TableRowProps>(
  (
    {
      children,
      dragState,
      interactive = false,
      selected = false,
      disabled = false,
      dimmed = false,
      preventTextSelection = false,
      ...props
    },
    ref,
  ) => (
    <tr
      {...nativeProps(props)}
      ref={ref}
      style={{ transform: dragState?.transform, transition: dragState?.transition }}
      data-reorderable={dragState ? true : undefined}
      data-dragging={dragState?.dragging || undefined}
      data-interactive={interactive || undefined}
      data-selected={selected || undefined}
      data-disabled={disabled || undefined}
      data-dimmed={dimmed || undefined}
      data-prevent-selection={preventTextSelection || undefined}
    >
      <ToolbarDensityProvider density={dragState ? 'compact' : 'comfortable'}>{children}</ToolbarDensityProvider>
    </tr>
  ),
);
export interface TableCellProps extends TableSectionProps {
  colSpan?: number;
  rowSpan?: number;
  width?: CSSProperties['width'];
  minWidth?: CSSProperties['minWidth'];
  align?: 'start' | 'center' | 'end';
  verticalAlign?: CSSProperties['verticalAlign'];
  scope?: 'row' | 'col' | 'rowgroup' | 'colgroup';
}
const Th = forwardRef<HTMLTableCellElement, TableCellProps>(
  (
    { children, width, minWidth, align = 'start', verticalAlign = 'middle', scope = 'col', colSpan, rowSpan, ...props },
    ref,
  ) => (
    <th
      {...nativeProps(props)}
      scope={scope}
      colSpan={colSpan}
      rowSpan={rowSpan}
      ref={ref}
      style={{ width, minWidth }}
      data-align={align}
      data-vertical-align={verticalAlign}
    >
      {children}
    </th>
  ),
);
const Td = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ children, width, minWidth, align = 'start', verticalAlign = 'middle', ...props }, ref) => (
    <td
      {...nativeProps(props)}
      colSpan={props.colSpan}
      rowSpan={props.rowSpan}
      ref={ref}
      style={{ width, minWidth }}
      data-align={align}
      data-vertical-align={verticalAlign}
    >
      {children}
    </td>
  ),
);
const TableScrollContainer = forwardRef<HTMLDivElement, TableSectionProps & { minWidth?: CSSProperties['minWidth'] }>(
  ({ children, minWidth, ...props }, ref) => (
    <div {...nativeProps(props)} ref={ref} className={classes.tableScroll}>
      <div style={{ minWidth }}>{children}</div>
    </div>
  ),
);
export const Table = Object.assign(TableRoot, { Thead, Tbody, Tr, Th, Td, ScrollContainer: TableScrollContainer });
