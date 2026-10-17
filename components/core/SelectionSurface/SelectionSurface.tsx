'use client';
import { forwardRef, useId, useState, type ReactNode, type CSSProperties } from 'react';
import { IconCornerLeftUp, IconCheck } from '@tabler/icons-react';
import { Button as AriaButton } from 'react-aria-components';
import { presentationAttributes, type PresentationProps } from '../presentation-contract';
import { MediaImage } from '../MediaImage';
import { IconButton } from '../IconButton';
import { TextButton } from '../TextButton';
import { Heading, Text, VisuallyHidden } from '../Typography';
import {
  spaceValue,
  resolveResponsive,
  isColumnCount,
  layoutPoints,
  type LayoutColumnCount,
  type Responsive,
  type Space,
} from '../Layout/layout-contract';
import classes from './SelectionSurface.module.css';
import { ToolbarLayout } from '../Section/ToolbarLayout';
import { ToolbarDensityProvider } from '../control-context';
export type SelectionDensity = 'compact' | 'workspace';
export type SelectionIconSize = 'small' | 'medium' | 'large';
export type SelectionGridSpacing = 'compact' | 'standard' | 'comfortable';
export type SelectionGridColumns = Responsive<LayoutColumnCount | 'auto'>;
export interface SelectionGridProps extends PresentationProps {
  label: string;
  density?: SelectionDensity;
  multiSelect?: boolean;
  columns?: SelectionGridColumns;
  iconSize?: SelectionIconSize;
  spacing?: SelectionGridSpacing;
  selectionStyle?: 'highlight' | 'checkbox' | 'grid';
}
function assertIconSize(value: SelectionIconSize) {
  if (!['small', 'medium', 'large'].includes(value)) {
    throw new RangeError('Invalid selection icon size');
  }
}
export const SelectionGrid = forwardRef<HTMLDivElement, SelectionGridProps>(
  (
    {
      label,
      density = 'compact',
      columns = 'auto',
      iconSize = 'medium',
      spacing = 'standard',
      multiSelect = true,
      selectionStyle = 'highlight',
      children,
      ...props
    },
    ref,
  ) => {
    assertIconSize(iconSize);
    if (!['compact', 'standard', 'comfortable'].includes(spacing)) {
      throw new RangeError('Invalid selection grid spacing');
    }
    const resolved = resolveResponsive<LayoutColumnCount | 'auto'>(
      columns,
      'auto',
      (value): value is LayoutColumnCount | 'auto' => value === 'auto' || isColumnCount(value),
      'selection grid columns',
    );
    const templates = Object.fromEntries(
      layoutPoints.map((point) => [
        `--_selection-template-${point}`,
        resolved[point] === 'auto'
          ? 'repeat(auto-fill, minmax(min(100%, var(--_selection-tile-min)), 1fr))'
          : `repeat(${resolved[point]}, minmax(0, 1fr))`,
      ]),
    );
    return (
      <div
        {...presentationAttributes(props)}
        ref={ref}
        className={classes.grid}
        data-density={density}
        data-icon-size={iconSize}
        data-spacing={spacing}
        style={templates as CSSProperties}
        role={selectionStyle === 'grid' ? 'grid' : selectionStyle === 'checkbox' ? 'group' : 'listbox'}
        aria-label={label}
        aria-multiselectable={selectionStyle !== 'checkbox' ? multiSelect : undefined}
      >
        {children}
      </div>
    );
  },
);
interface SelectionSurfaceBaseProps extends PresentationProps {
  label: string;
  density?: SelectionDensity;
  appearance?: 'tile' | 'file';
  iconSize?: SelectionIconSize;
  preview: ReactNode;
  actions?: ReactNode;
  selectionStyle?: 'highlight' | 'checkbox' | 'grid';
  selectionControl?: ReactNode;
}
export type SelectionSurfaceProps = SelectionSurfaceBaseProps &
  (
    | {
        selected?: boolean;
        unavailable?: boolean;
        selectionUnavailable?: false;
        selectionUnavailableDescription?: never;
      }
    | {
        selected?: false;
        unavailable?: never;
        /** Selection is unavailable; independent preview or context actions remain available. */
        selectionUnavailable: true;
        selectionUnavailableDescription: string;
      }
  );
/** Controller owns selection/navigation policy; this owner owns all selection and focus presentation. */
export const SelectionSurface = forwardRef<HTMLDivElement, SelectionSurfaceProps>(
  (
    {
      label,
      selected = false,
      unavailable = false,
      selectionUnavailable = false,
      selectionUnavailableDescription,
      density = 'compact',
      appearance = 'tile',
      iconSize = 'medium',
      preview,
      actions,
      selectionStyle = 'highlight',
      selectionControl,
      ...props
    },
    ref,
  ) => {
    const selectionDescriptionId = useId();
    assertIconSize(iconSize);
    if (!['tile', 'file'].includes(appearance)) {
      throw new RangeError('Invalid selection surface appearance');
    }
    if (selectionUnavailable && (unavailable || selected || !selectionUnavailableDescription?.trim())) {
      throw new TypeError('An unselectable item needs a description and cannot be selected or fully unavailable');
    }
    return (
      <div
        {...presentationAttributes(props)}
        ref={ref}
        className={classes.item}
        role={selectionStyle === 'grid' ? 'row' : selectionStyle === 'checkbox' ? 'group' : 'option'}
        aria-label={label}
        aria-selected={selectionStyle !== 'checkbox' ? selected : undefined}
        aria-disabled={unavailable || undefined}
        aria-describedby={
          [props['aria-describedby'], selectionUnavailable ? selectionDescriptionId : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
        tabIndex={props.tabIndex ?? 0}
        data-selected={selected || undefined}
        data-unavailable={unavailable || selectionUnavailable || undefined}
        data-selection-unavailable={selectionUnavailable || undefined}
        data-density={density}
        data-appearance={appearance}
        data-icon-size={iconSize}
      >
        <div className={classes.preview} role={selectionStyle === 'grid' ? 'gridcell' : undefined}>
          {preview}
          {selected && !selectionControl && appearance !== 'file' ? (
            <span className={classes.selectionMark} aria-hidden>
              <IconCheck />
            </span>
          ) : null}
          {selectionControl ? (
            <div
              role="presentation"
              className={classes.selectionControl}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              {selectionControl}
            </div>
          ) : null}
          {actions ? <div className={classes.actions}>{actions}</div> : null}
        </div>
        <div className={classes.name} title={label} role={selectionStyle === 'grid' ? 'gridcell' : undefined}>
          {label}
          {selectionUnavailable ? (
            <VisuallyHidden id={selectionDescriptionId}>{selectionUnavailableDescription}</VisuallyHidden>
          ) : null}
        </div>
      </div>
    );
  },
);
export interface SelectionThumbnailProps extends PresentationProps {
  src?: string;
  icon?: ReactNode;
  size?: 'inline' | SelectionDensity | 'preview';
  fit?: 'contain' | 'cover';
  tone?: 'neutral' | 'muted';
}
export function SelectionThumbnail({
  src,
  icon,
  size = 'compact',
  tone = 'muted',
  fit = 'cover',
  ...props
}: SelectionThumbnailProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return (
    <span {...presentationAttributes(props)} className={classes.thumbnail} data-size={size} data-tone={tone}>
      {src && src !== failedSource ? (
        <MediaImage src={src} alt="" fill fit={fit} onError={() => setFailedSource(src)} />
      ) : (
        icon
      )}
    </span>
  );
}
export interface SelectionViewportProps extends PresentationProps {
  inset?: Space;
}
export const SelectionViewport = forwardRef<HTMLDivElement, SelectionViewportProps>(
  ({ inset = 'md', children, ...props }, ref) => (
    <div
      {...presentationAttributes(props)}
      ref={ref}
      className={classes.viewport}
      data-inset={inset}
      style={{ '--_selection-inset': spaceValue(inset) } as CSSProperties}
    >
      {children}
    </div>
  ),
);
export function SelectionEmptyState({ children, ...props }: PresentationProps) {
  return (
    <div {...presentationAttributes(props)} className={classes.empty}>
      {children}
    </div>
  );
}
export function SelectionMarquee({ rect }: { rect: { left: number; top: number; width: number; height: number } }) {
  return <div className={classes.marquee} style={rect} aria-hidden />;
}
export interface SelectionToolbarProps extends PresentationProps {
  location: ReactNode;
  search: ReactNode;
  filters: ReactNode;
  actions: ReactNode;
  arrangement?: 'actions-end' | 'actions-inline';
  bordered?: boolean;
  divider?: 'surface' | 'none';
  description?: string;
}
export function SelectionToolbar({
  location,
  search,
  filters,
  actions,
  arrangement = 'actions-end',
  bordered = false,
  divider = 'surface',
  description,
  ...props
}: SelectionToolbarProps) {
  return (
    <ToolbarLayout
      {...props}
      leading={location}
      search={search}
      filters={filters}
      actions={actions}
      arrangement={arrangement}
      inset={bordered ? 'content' : 'none'}
      divider={divider}
      description={description}
    />
  );
}

export interface SelectionPathProps {
  items: readonly { id?: string; name: string }[];
  label?: string;
  parentLabel?: string;
  onOpen: (index: number) => void;
  /** The current location is the page title (h1), for a browser that is the whole page. */
  pageTitle?: boolean;
}
export function SelectionPath({ items, label, parentLabel, onOpen, pageTitle = false }: SelectionPathProps) {
  return (
    <nav
      className={classes.path}
      aria-label={label}
      title={items.map((item) => item.name).join(' / ')}
      data-page-title={pageTitle || undefined}
    >
      {parentLabel && items.length > 1 ? (
        <IconButton aria-label={parentLabel} title={parentLabel} onClick={() => onOpen(items.length - 2)}>
          <IconCornerLeftUp aria-hidden />
        </IconButton>
      ) : null}
      <ol>
        {items.map((item, index) => (
          <li key={item.id ?? index}>
            {index > 0 ? (
              <span className={classes.pathSeparator} aria-hidden>
                /
              </span>
            ) : null}
            {index < items.length - 1 ? (
              <TextButton appearance="default" onClick={() => onOpen(index)}>
                <Text as="span" size="sm" truncate>
                  {item.name}
                </Text>
              </TextButton>
            ) : pageTitle ? (
              <Heading level={1} scale={{ base: 3, sm: 2 }} truncate title={item.name} aria-current="location">
                {item.name}
              </Heading>
            ) : (
              <Text as="span" size="sm" weight="strong" truncate title={item.name} aria-current="location">
                {item.name}
              </Text>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
export interface SelectionStatusProps extends PresentationProps {
  trailing?: ReactNode;
  density?: 'compact' | 'standard';
  divider?: 'surface' | 'content' | 'none';
}
export function SelectionStatus({
  children,
  trailing,
  density = 'compact',
  divider = 'surface',
  ...props
}: SelectionStatusProps) {
  if (!['surface', 'content', 'none'].includes(divider)) {
    throw new RangeError('Invalid selection status divider');
  }
  return (
    <div {...presentationAttributes(props)} className={classes.status} data-density={density} data-divider={divider}>
      <Text size="xs" tone="secondary" truncate aria-live="polite">
        {children}
      </Text>
      <ToolbarDensityProvider density={density === 'compact' ? 'compact' : 'comfortable'}>
        {trailing}
      </ToolbarDensityProvider>
    </div>
  );
}
export function SelectionScope({ children, ...props }: PresentationProps) {
  return (
    <div {...presentationAttributes(props)} className={classes.scope}>
      {children}
    </div>
  );
}

export interface SelectionRowProps extends PresentationProps {
  density?: 'compact' | 'standard';
  selected?: boolean;
  disabled?: boolean;
  appearance?: 'plain' | 'muted';
  onAction?: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
}
/** The label is the action; nested checkbox and menu actions remain independent native siblings. */
export function SelectionRow({
  density = 'standard',
  selected = false,
  disabled = false,
  appearance = 'plain',
  onAction,
  leading,
  trailing,
  children,
  ...props
}: SelectionRowProps) {
  return (
    <div
      {...presentationAttributes(props)}
      className={classes.row}
      data-density={density}
      role="group"
      data-selected={selected || undefined}
      data-disabled={disabled || undefined}
      data-appearance={appearance}
    >
      {leading ? (
        <span className={classes.rowLeading}>
          <ToolbarDensityProvider density={density === 'compact' ? 'compact' : 'comfortable'}>
            {leading}
          </ToolbarDensityProvider>
        </span>
      ) : null}
      <div className={classes.rowLabel}>
        {onAction ? (
          <AriaButton className={classes.rowAction} isDisabled={disabled} onPress={onAction}>
            {children}
          </AriaButton>
        ) : (
          children
        )}
      </div>
      <ToolbarDensityProvider density={density === 'compact' ? 'compact' : 'comfortable'}>
        {trailing}
      </ToolbarDensityProvider>
    </div>
  );
}
