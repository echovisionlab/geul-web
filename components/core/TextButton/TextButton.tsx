'use client';

import {
  forwardRef,
  useId,
  type CSSProperties,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from 'react';
import { Button as AriaButton, Link as AriaLink, ProgressBar } from 'react-aria-components';
import { ariaControlClick, controlNativeProps, type ControlNativeProps } from '../control-props';
import { controlLinkRender } from '../control-render';
import {
  navigationHref,
  useNavigationClick,
  useNavigationPrefetchHandlers,
  type NavigationHref,
  type NavigationOptions,
} from '../Navigation/navigation-events';
import controlClasses from '../Control.module.css';
import spinnerClasses from '../Spinner.module.css';
import classes from './TextButton.module.css';
import {
  resolveActionSize,
  useActionRowSize,
  useControlContrast,
  useToolbarDensity,
  type ControlContrast,
} from '../control-context';
import { ControlIndicator, type ControlIndicatorKind } from '../control-indicator';
import { useHierarchyStep } from '../Hierarchy';

export type TextButtonAppearance = 'default' | 'muted' | 'accent';
export type TextButtonSize = 'xs' | 'sm' | 'md';
export type TextButtonControlSize = 'xs' | 'sm' | 'md';
export type TextButtonWeight = 'regular' | 'medium' | 'semibold';
export type TextButtonDisplay = 'inline' | 'inline-flex' | 'flex' | 'block';
interface TextButtonSharedProps extends ControlNativeProps {
  children: ReactNode;
  appearance?: TextButtonAppearance;
  contrast?: ControlContrast;
  tone?: import('../Typography').TextTone;
  size?: TextButtonSize;
  controlSize?: TextButtonControlSize;
  weight?: TextButtonWeight;
  display?: TextButtonDisplay;
  fullWidth?: boolean;
  nowrap?: boolean;
  font?: 'ui' | 'mono';
  density?: 'inline' | 'chrome';
  justify?: 'start' | 'center' | 'end' | 'between';
  selected?: boolean;
  nested?: boolean;
  gap?: 'none' | 'xxs' | 'xs' | 'sm';
}
export interface TextButtonButtonProps extends TextButtonSharedProps {
  /** Controlled command pending state; keeps the text and focus while blocking activation. */
  loading?: boolean;
  loadingLabel?: string;
  indicator?: ControlIndicatorKind;
  href?: never;
  type?: 'button' | 'submit' | 'reset';
  form?: string;
  disabled?: boolean;
  target?: never;
  rel?: never;
  download?: never;
  onNavigate?: never;
  replace?: never;
  scroll?: never;
  prefetch?: never;
}
export interface TextButtonLinkProps
  extends Omit<TextButtonSharedProps, 'onClick'>, Omit<NavigationOptions, 'onNavigate'> {
  indicator?: never;
  loading?: never;
  loadingLabel?: never;
  disabled?: never;
  onClick?: never;
  type?: never;
  form?: never;
  onNavigate?: (href: NavigationHref) => void;
}
export type TextButtonProps = TextButtonButtonProps | TextButtonLinkProps;
type TextButtonComponent = {
  (props: TextButtonButtonProps & RefAttributes<HTMLButtonElement>): ReactElement | null;
  (props: TextButtonLinkProps & RefAttributes<HTMLAnchorElement>): ReactElement | null;
};
function TextButtonInner(
  {
    appearance = 'default',
    tone,
    contrast,
    size = 'sm',
    controlSize: requestedControlSize,
    weight,
    display = 'inline-flex',
    fullWidth = false,
    nowrap = false,
    font = 'ui',
    density = 'inline',
    justify = 'start',
    selected = false,
    nested = false,
    gap = 'xxs',
    children,
    indicator,
    loading = false,
    loadingLabel,
    ...props
  }: TextButtonProps,
  ref: ForwardedRef<HTMLButtonElement | HTMLAnchorElement>,
) {
  const descriptionId = useId();
  const labelId = useId();
  const description = props['aria-description'];
  const rowSize = useActionRowSize();
  const hierarchyStep = useHierarchyStep();
  const inheritedContrast = useControlContrast();
  const toolbarDensity = useToolbarDensity();
  const controlSize = resolveActionSize(requestedControlSize, rowSize, toolbarDensity);
  const { href, onNavigate, onClick, ...native } = props;
  const navigation = props as TextButtonLinkProps;
  const navigationClick = useNavigationClick({
    ...navigation,
    href: href ?? '',
    onNavigate: onNavigate ? () => onNavigate(href!) : undefined,
  });
  const prefetchHandlers = useNavigationPrefetchHandlers(
    { ...navigation, href: href ?? '', prefetch: href === undefined ? false : navigation.prefetch },
    props,
  );
  const shared = {
    ...controlNativeProps(native),
    'aria-describedby':
      [native['aria-describedby'], description ? descriptionId : undefined].filter(Boolean).join(' ') || undefined,
    className: `${controlClasses.root} ${classes.root}`,
    'data-contrast': contrast ?? inheritedContrast,
    'data-appearance': appearance,
    'data-size': toolbarDensity === 'compact' ? 'xs' : size,
    'data-control-size': controlSize,
    'data-weight': weight ?? (controlSize ? 'medium' : 'regular'),
    'data-display': display,
    'data-full-width': fullWidth || undefined,
    'data-nowrap': nowrap || undefined,
    'data-font': font,
    'data-density': density,
    'data-justify': justify,
    'data-selected': selected || undefined,
    'data-geul-hierarchy-nested': nested || undefined,
    style: { '--_hierarchy-step': hierarchyStep } as CSSProperties,
    'data-gap': gap,
    'data-control-kind': 'text',
    'data-tone': tone ?? (appearance === 'accent' ? 'accent' : 'neutral'),
    'data-emphasis': appearance === 'muted' ? 'low' : 'medium',
  };
  const content =
    indicator || href === undefined ? (
      <>
        <span id={labelId} className={indicator ? `${controlClasses.label} ${classes.label}` : classes.content}>
          {children}
        </span>
        {indicator ? <ControlIndicator kind={indicator} /> : null}
        {loading ? (
          <ProgressBar
            isIndeterminate
            aria-label={loadingLabel ?? props['aria-label']}
            aria-labelledby={loadingLabel || props['aria-label'] ? undefined : (props['aria-labelledby'] ?? labelId)}
            className={`${spinnerClasses.spinner} ${classes.spinner}`}
          />
        ) : null}
      </>
    ) : (
      children
    );
  if (href !== undefined) {
    return (
      <AriaLink
        {...shared}
        ref={ref as ForwardedRef<HTMLAnchorElement>}
        href={navigationHref(href)}
        target={navigation.target}
        rel={navigation.rel}
        download={navigation.download}
        routerOptions={{ replace: navigation.replace, scroll: navigation.scroll }}
        // Link has no excludeFromTabOrder API. Its documented render hook preserves native tabIndex.
        render={controlLinkRender({ title: native.title, tabIndex: native.tabIndex })}
        onClick={navigationClick}
        {...prefetchHandlers}
      >
        {content}
        {description ? (
          <span id={descriptionId} hidden>
            {description}
          </span>
        ) : null}
      </AriaLink>
    );
  }
  const action = props as TextButtonButtonProps;
  return (
    <AriaButton
      {...shared}
      ref={ref as ForwardedRef<HTMLButtonElement>}
      type={loading ? 'button' : (action.type ?? 'button')}
      form={action.form}
      isDisabled={action.disabled}
      isPending={loading}
      excludeFromTabOrder={native.tabIndex === -1}
      render={(domProps) => (
        <button
          {...domProps}
          type={domProps.type === 'submit' ? 'submit' : domProps.type === 'reset' ? 'reset' : 'button'}
          // React Aria filters `title` from DOM props; keep the accepted native advisory text.
          title={native.title}
          aria-busy={loading || undefined}
          aria-labelledby={
            loading
              ? (props['aria-labelledby'] ?? (props['aria-label'] ? undefined : labelId))
              : domProps['aria-labelledby']
          }
        />
      )}
      onClick={ariaControlClick(loading ? undefined : onClick)}
    >
      {content}
      {description ? (
        <span id={descriptionId} hidden>
          {description}
        </span>
      ) : null}
    </AriaButton>
  );
}
const TextButtonBase = forwardRef<HTMLButtonElement | HTMLAnchorElement, TextButtonProps>(TextButtonInner);
TextButtonBase.displayName = 'TextButton';
export const TextButton = TextButtonBase as TextButtonComponent;
