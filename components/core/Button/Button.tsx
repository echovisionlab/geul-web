'use client';

import { forwardRef, useId, type ForwardedRef, type ReactElement, type RefAttributes } from 'react';
import { Button as AriaButton, Link as AriaLink, ProgressBar } from 'react-aria-components';
import {
  ariaControlClick,
  controlNativeProps,
  type ControlContentProps,
  type ControlNativeProps,
} from '../control-props';
import { controlLinkRender } from '../control-render';
import type { ButtonSize, ControlEmphasis, ControlTone } from '../control-style';
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
  useHeaderDensity,
  useToolbarDensity,
  type ControlContrast,
} from '../control-context';
import { ControlIndicator, type ControlIndicatorKind } from '../control-indicator';

interface SharedButtonProps extends ControlNativeProps, ControlContentProps {
  size?: ButtonSize;
  contrast?: ControlContrast;
  tone?: ControlTone;
  emphasis?: ControlEmphasis;
  labelWrap?: 'nowrap' | 'wrap';
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
}
export interface ButtonActionProps extends SharedButtonProps {
  indicator?: ControlIndicatorKind;
  href?: never;
  type?: 'button' | 'submit' | 'reset';
  form?: string;
  name?: string;
  value?: string;
  target?: never;
  rel?: never;
  download?: never;
  replace?: never;
  scroll?: never;
  prefetch?: never;
  onNavigate?: never;
}
export interface ButtonLinkProps extends SharedButtonProps, NavigationOptions {
  indicator?: never;
  type?: never;
  form?: never;
  name?: never;
  value?: never;
}
export type ButtonProps = ButtonActionProps | ButtonLinkProps;
type ButtonComponent = {
  (props: ButtonActionProps & RefAttributes<HTMLButtonElement>): ReactElement | null;
  (props: ButtonLinkProps & RefAttributes<HTMLAnchorElement>): ReactElement | null;
};

function ButtonInner(
  {
    tone = 'neutral',
    contrast,
    emphasis = 'medium',
    size: requestedSize,
    children,
    leftSection,
    rightSection,
    indicator,
    fullWidth,
    justify = 'center',
    printVisibility,
    labelWrap = 'nowrap',
    loading = false,
    loadingLabel,
    disabled = false,
    ...props
  }: ButtonProps,
  ref: ForwardedRef<HTMLButtonElement | HTMLAnchorElement>,
) {
  const rowSize = useActionRowSize();
  const headerDensity = useHeaderDensity();
  const inheritedContrast = useControlContrast();
  const toolbarDensity = useToolbarDensity();
  const size = resolveActionSize(requestedSize ?? 'sm', rowSize, toolbarDensity);
  const labelId = useId();
  const { href, onClick, ...nativeProps } = props;
  const navigation = props as ButtonLinkProps;
  const navigationClick = useNavigationClick({ ...navigation, href: href ?? '' }, onClick);
  const prefetchHandlers = useNavigationPrefetchHandlers(
    {
      ...navigation,
      href: href ?? '',
      prefetch: href === undefined || disabled || loading ? false : navigation.prefetch,
    },
    props,
  );
  const shared = {
    ...controlNativeProps(nativeProps),
    className: classes.root,
    'data-contrast': contrast ?? inheritedContrast,
    'data-tone': tone,
    'data-emphasis': emphasis,
    'data-control-kind': 'button',
    'data-geul-control-header-density': headerDensity,
    'data-size': size,
    'data-control-size': size,
    'data-full-width': fullWidth || undefined,
    'data-justify': justify,
    'data-print-visibility': printVisibility,
    'data-loading': loading || undefined,
    'data-label-wrap': labelWrap,
    'aria-busy': loading || undefined,
  };
  const content = (
    <span className={classes.inner}>
      {leftSection ? (
        <span className={classes.section} data-position="left">
          {leftSection}
        </span>
      ) : null}
      <span className={classes.label} id={labelId}>
        {children}
      </span>
      {rightSection ? (
        <span className={classes.section} data-position="right">
          {rightSection}
        </span>
      ) : null}
      {indicator ? <ControlIndicator kind={indicator} /> : null}
      {loading ? (
        <ProgressBar
          isIndeterminate
          aria-label={loadingLabel ?? props['aria-label']}
          aria-labelledby={loadingLabel || props['aria-label'] ? undefined : (props['aria-labelledby'] ?? labelId)}
          className={`${spinnerClasses.spinner} ${classes.spinner}`}
        />
      ) : null}
    </span>
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
        render={controlLinkRender({
          title: nativeProps.title,
          tabIndex: nativeProps.tabIndex,
          pending: loading,
          disabled,
        })}
        isDisabled={disabled || loading}
        onClick={navigationClick}
        {...prefetchHandlers}
      >
        {content}
      </AriaLink>
    );
  }
  const button = props as ButtonActionProps;
  return (
    <AriaButton
      {...shared}
      ref={ref as ForwardedRef<HTMLButtonElement>}
      type={loading ? 'button' : (button.type ?? 'button')}
      form={button.form}
      name={button.name}
      value={button.value}
      isDisabled={disabled}
      excludeFromTabOrder={nativeProps.tabIndex === -1}
      isPending={loading}
      render={(domProps) => (
        <button
          {...domProps}
          type={domProps.type === 'submit' ? 'submit' : domProps.type === 'reset' ? 'reset' : 'button'}
          // React Aria filters `title` from DOM props; keep the accepted native advisory text.
          title={nativeProps.title}
          aria-busy={loading || undefined}
          // RAC appends progress to the pending name. Keep the action's own name stable.
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
    </AriaButton>
  );
}
const ButtonBase = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(ButtonInner);
ButtonBase.displayName = 'Button';
export const Button = ButtonBase as ButtonComponent;
