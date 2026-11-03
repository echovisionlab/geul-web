'use client';

import {
  forwardRef,
  useCallback,
  type ForwardedRef,
  type DragEvent,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from 'react';
import { Button as AriaButton, Link as AriaLink, ProgressBar } from 'react-aria-components';
import { ariaControlClick, controlNativeProps, type ControlNativeProps } from '../control-props';
import { controlLinkRender } from '../control-render';
import type { ControlEmphasis, ControlTone, ControlSize } from '../control-style';
import {
  navigationHref,
  useNavigationClick,
  useNavigationPrefetchHandlers,
  type NavigationOptions,
} from '../Navigation/navigation-events';
import classes from '../Control.module.css';
import spinnerClasses from '../Spinner.module.css';
import {
  resolveActionSize,
  useActionRowSize,
  useControlContrast,
  useToolbarDensity,
  type ControlContrast,
} from '../control-context';

export type IconButtonAccessibleName =
  | { label: string; 'aria-label'?: never; 'aria-labelledby'?: never }
  | { label?: never; 'aria-label': string; 'aria-labelledby'?: never }
  | { label?: never; 'aria-label'?: never; 'aria-labelledby': string };
export type IconButtonSize = ControlSize | 'chrome' | 'compact';
type IconButtonPlacement = 'inline' | 'overlay-start' | 'overlay-start-inside' | 'overlay-end' | 'overlay-end-inside';
type IconButtonAppearance =
  | {
      appearance?: 'default';
      size?: IconButtonSize;
      shape?: 'square' | 'circle';
      placement?: IconButtonPlacement;
    }
  | {
      /** Small media-corner badge with an independent, full-size interaction target. */
      appearance: 'media-overlay';
      placement: 'overlay-start-inside' | 'overlay-end-inside';
      size?: never;
      shape?: never;
      pressed?: never;
      count?: never;
      contrast?: never;
    };
interface IconButtonSharedProps extends Omit<ControlNativeProps, 'aria-label' | 'aria-labelledby' | 'aria-pressed'> {
  children?: ReactNode;
  count?: number;
  contrast?: ControlContrast;
  tone?: ControlTone;
  emphasis?: ControlEmphasis;
  loading?: boolean;
  disabled?: boolean;
  printVisibility?: 'normal' | 'hidden';
}
/**
 * A command chooses its tone and emphasis. A toggle reports `pressed`; Core then owns the
 * neutral resting treatment and the persistent selected surface, so callers cannot pick a
 * different tone or emphasis for the same pressed state.
 */
export type IconButtonPressState = { pressed?: undefined } | { pressed: boolean; tone?: never; emphasis?: never };
/** Reorder geometry is owned by Core; action sizing cannot leak into a sensor handle. */
type IconButtonGeometry =
  | (IconButtonAppearance & {
      interaction?: 'action';
      type?: 'button' | 'submit' | 'reset';
      'aria-pressed'?: never;
    })
  | {
      interaction: 'drag-handle';
      appearance?: never;
      size?: never;
      shape?: 'square' | 'circle';
      placement?: IconButtonPlacement;
      type?: 'button';
      pressed?: never;
      /** Sensor libraries report their own pressed state on the activator. */
      'aria-pressed'?: ControlNativeProps['aria-pressed'];
    };
export type IconButtonActionProps = IconButtonSharedProps &
  IconButtonGeometry &
  IconButtonPressState &
  IconButtonAccessibleName & {
    href?: never;
    target?: never;
    rel?: never;
    download?: never;
    replace?: never;
    scroll?: never;
    prefetch?: never;
    onNavigate?: never;
  };
export type IconButtonLinkProps = IconButtonSharedProps & {
  interaction?: 'action';
  appearance?: 'default';
  size?: IconButtonSize;
  shape?: 'square' | 'circle';
  placement?: IconButtonPlacement;
  pressed?: never;
} & IconButtonAccessibleName &
  NavigationOptions & { type?: never };
export type IconButtonProps = IconButtonActionProps | IconButtonLinkProps;
type IconButtonComponent = {
  (props: IconButtonActionProps & RefAttributes<HTMLButtonElement>): ReactElement | null;
  (props: IconButtonLinkProps & RefAttributes<HTMLAnchorElement>): ReactElement | null;
};
function IconButtonInner(
  {
    tone: requestedTone = 'neutral',
    contrast,
    emphasis: requestedEmphasis = 'low',
    pressed,
    shape = 'square',
    size,
    label,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    children,
    count,
    loading = false,
    disabled = false,
    interaction = 'action',
    appearance = 'default',
    printVisibility,
    placement = 'inline',
    ...props
  }: IconButtonProps,
  ref: ForwardedRef<HTMLButtonElement | HTMLAnchorElement>,
) {
  const { href, onClick, ...native } = props;
  const mediaOverlay = appearance === 'media-overlay';
  if (mediaOverlay && (href !== undefined || !['overlay-start-inside', 'overlay-end-inside'].includes(placement))) {
    throw new TypeError('Media overlay commands require inside media placement');
  }
  const toggle = interaction !== 'drag-handle' && href === undefined && typeof pressed === 'boolean';
  // A toggle's resting and selected appearance belongs to Core, not to the caller's tone choice.
  const tone = toggle ? 'neutral' : requestedTone;
  const emphasis = toggle ? 'low' : requestedEmphasis;
  // React Aria filters draggable from its DOM props. Preserve the native drag
  // affordance on the actual control, including consumers' forwarded refs.
  const controlRef = useCallback(
    (element: HTMLButtonElement | HTMLAnchorElement | null) => {
      if (element) {
        element.draggable = !disabled && !loading && (native.draggable ?? interaction === 'drag-handle');
      }
      if (typeof ref === 'function') {
        ref(element);
      } else if (ref) {
        ref.current = element;
      }
    },
    [interaction, native.draggable, disabled, loading, ref],
  );
  const navigation = props as IconButtonLinkProps;
  const navigationClick = useNavigationClick({ ...navigation, href: href ?? '' }, onClick);
  const rowSize = useActionRowSize();
  const inheritedContrast = useControlContrast();
  const toolbarDensity = useToolbarDensity();
  const resolvedSize = mediaOverlay
    ? 'compact'
    : interaction === 'drag-handle'
      ? 'compact'
      : resolveActionSize(size ?? 'xs', rowSize, toolbarDensity);
  const prefetchHandlers = useNavigationPrefetchHandlers(
    {
      ...navigation,
      href: href ?? '',
      prefetch: href === undefined || disabled || loading ? false : navigation.prefetch,
    },
    props,
  );
  const shared = {
    ...controlNativeProps(native),
    className: classes.root,
    'data-contrast': mediaOverlay ? 'standard' : (contrast ?? inheritedContrast),
    'aria-label': ariaLabel ?? label,
    'aria-labelledby': ariaLabelledBy,
    'aria-busy': loading || undefined,
    ...(toggle ? { 'aria-pressed': pressed } : interaction === 'action' ? { 'aria-pressed': undefined } : {}),
    'data-tone': tone,
    'data-emphasis': emphasis,
    'data-shape': mediaOverlay ? 'square' : shape,
    'data-appearance': mediaOverlay ? appearance : undefined,
    'data-control-size': resolvedSize,
    'data-geul-control-toolbar-density': toolbarDensity,
    'data-control-kind': 'icon',
    'data-loading': loading || undefined,
    'data-interaction': interaction,
    'data-print-visibility': printVisibility,
    'data-placement': placement,
  };
  if (count !== undefined && (!Number.isSafeInteger(count) || count < 0)) {
    throw new RangeError('Core IconButton count must be a nonnegative safe integer');
  }
  const nameChannels = [label, ariaLabel, ariaLabelledBy].filter((name) => name !== undefined);
  if (nameChannels.length !== 1 || typeof nameChannels[0] !== 'string' || !nameChannels[0].trim()) {
    throw new TypeError('Core IconButton requires exactly one nonempty label, aria-label, or aria-labelledby');
  }
  const glyph = loading ? (
    <ProgressBar
      isIndeterminate
      aria-label={ariaLabel ?? label}
      aria-labelledby={ariaLabelledBy}
      className={`${spinnerClasses.spinner} ${classes.spinner}`}
    />
  ) : (
    <>
      {children}
      {count ? (
        <span className={classes.counter} aria-hidden>
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </>
  );
  const content = mediaOverlay ? (
    <span className={classes.mediaOverlay} data-emphasis={emphasis}>
      {glyph}
    </span>
  ) : (
    glyph
  );
  if (href !== undefined) {
    return (
      <AriaLink
        {...shared}
        ref={controlRef}
        href={navigationHref(href)}
        target={navigation.target}
        rel={navigation.rel}
        download={navigation.download}
        routerOptions={{ replace: navigation.replace, scroll: navigation.scroll }}
        // Link has no excludeFromTabOrder API. Its documented render hook preserves native tabIndex.
        render={controlLinkRender({ title: native.title, tabIndex: native.tabIndex, pending: loading, disabled })}
        isDisabled={disabled || loading}
        onClick={navigationClick}
        {...prefetchHandlers}
      >
        {content}
      </AriaLink>
    );
  }
  // A sensor handle is not a press action: its Space/Enter keys must bubble
  // to the active document-level reorder sensor, including the drop key.
  if (interaction === 'drag-handle') {
    const onDragStart = (event: DragEvent<HTMLButtonElement>) => {
      if (disabled || loading) {
        event.preventDefault();
        return;
      }
      const row = event.currentTarget.closest<HTMLElement>('[data-geul-reorder-row]');
      if (row && event.dataTransfer.setDragImage) {
        const bounds = row.getBoundingClientRect();
        event.dataTransfer.setDragImage(row, event.clientX - bounds.left, event.clientY - bounds.top);
      }
      native.onDragStart?.(event);
    };
    return (
      <button
        {...shared}
        ref={controlRef}
        type="button"
        disabled={disabled || loading}
        data-disabled={disabled || loading || undefined}
        data-pending={loading || undefined}
        onClick={loading ? undefined : onClick}
        onDragStart={onDragStart}
      >
        {content}
      </button>
    );
  }
  return (
    <AriaButton
      {...shared}
      ref={controlRef}
      type={loading ? 'button' : ((props as IconButtonActionProps).type ?? 'button')}
      isDisabled={disabled}
      excludeFromTabOrder={native.tabIndex === -1}
      isPending={loading}
      render={(domProps) => (
        <button
          {...domProps}
          type={domProps.type === 'submit' ? 'submit' : domProps.type === 'reset' ? 'reset' : 'button'}
          // React Aria filters `title` from DOM props; keep the accepted native advisory text.
          title={native.title}
          aria-busy={loading || undefined}
          // Progress stays named separately; it must not be appended to the action name.
          aria-labelledby={loading ? ariaLabelledBy : domProps['aria-labelledby']}
        />
      )}
      onClick={ariaControlClick(loading ? undefined : onClick)}
    >
      {content}
    </AriaButton>
  );
}
const IconButtonBase = forwardRef<HTMLButtonElement | HTMLAnchorElement, IconButtonProps>(IconButtonInner);
IconButtonBase.displayName = 'IconButton';
export const IconButton = IconButtonBase as IconButtonComponent;
