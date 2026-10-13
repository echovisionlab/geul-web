'use client';

import { forwardRef, type ReactNode } from 'react';
import { Link as AriaLink } from 'react-aria-components';
import { controlNativeProps, type ControlNativeProps } from '../control-props';
import { controlLinkRender } from '../control-render';
import {
  navigationHref,
  useNavigationClick,
  useNavigationPrefetchHandlers,
  type NavigationOptions,
} from './navigation-events';
import classes from './NavigationLink.module.css';

export interface LinkProps extends ControlNativeProps, NavigationOptions {
  children?: ReactNode;
  /**
   * `content` underlined text; `quiet` underline on hover; `block`/`row` block regions;
   * `media` overlay covering media; `graphic` a content-sized inline box around a logo or image.
   */
  appearance?: 'content' | 'quiet' | 'block' | 'media' | 'row' | 'graphic';
  mediaPosition?: 'fill' | 'flow';
  separator?: 'none' | 'start';
  size?: 'xs' | 'sm' | 'md';
  weight?: 'regular' | 'medium' | 'strong';
  tone?: 'primary' | 'secondary' | 'muted' | 'inverse' | 'inherit';
}
export type NextLinkProps = NavigationOptions;

const NavigationLink = forwardRef<HTMLAnchorElement, LinkProps>(
  (
    {
      href,
      replace,
      scroll,
      prefetch,
      target,
      rel,
      download,
      onNavigate,
      onClick,
      children,
      appearance = 'content',
      mediaPosition = 'fill',
      separator = 'none',
      size,
      weight,
      tone = 'primary',
      ...props
    },
    ref,
  ) => {
    const handleClick = useNavigationClick({ href, replace, scroll, target, download, onNavigate }, onClick);
    const prefetchHandlers = useNavigationPrefetchHandlers({ href, prefetch, target, download }, props);
    const native = controlNativeProps(props);
    return (
      <AriaLink
        {...native}
        ref={ref}
        href={navigationHref(href)}
        target={target}
        rel={rel}
        download={download}
        routerOptions={{ replace, scroll }}
        onClick={handleClick}
        {...prefetchHandlers}
        render={controlLinkRender({ title: native.title, tabIndex: native.tabIndex })}
        className={classes.root}
        data-appearance={appearance}
        data-media-position={appearance === 'media' ? mediaPosition : undefined}
        data-separator={separator}
        data-size={size}
        data-weight={weight}
        data-tone={tone}
      >
        {children}
      </AriaLink>
    );
  },
);
NavigationLink.displayName = 'NavigationLink';
export { NavigationLink };
export default NavigationLink;
