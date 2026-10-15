'use client';

import type { LinkProps as AriaLinkProps } from 'react-aria-components';
import { useCallback, type MouseEvent, type MouseEventHandler } from 'react';
import type { LinkProps as NextLinkNativeProps } from 'next/link';
import { useNavigationPrefetch } from './navigation-prefetch';
import { useNavigationIntentHandler } from './NavigationIntentProvider';

export interface NavigationRouterOptions {
  replace?: boolean;
  scroll?: boolean;
}
declare module 'react-aria-components' {
  interface RouterConfig {
    routerOptions: NavigationRouterOptions;
  }
}

export type NavigationHref = NextLinkNativeProps['href'];
export interface NavigationOptions {
  href: NavigationHref;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean | null;
  target?: string;
  rel?: string;
  download?: string | boolean;
  onNavigate?: (event: { preventDefault: () => void }) => void;
}

export function navigationHref(href: NavigationHref): string {
  if (typeof href === 'string') {
    return href;
  }
  const query =
    typeof href.query === 'string'
      ? href.query
      : (() => {
          const search = new URLSearchParams();
          for (const [key, value] of Object.entries(href.query ?? {})) {
            for (const item of Array.isArray(value) ? value : [value]) {
              if (item !== undefined && item !== null) {
                search.append(key, String(item));
              }
            }
          }
          return search.toString();
        })();
  const authority = href.host ?? (href.hostname ? `${href.hostname}${href.port ? `:${href.port}` : ''}` : '');
  return `${authority ? `${href.protocol ?? 'https:'}//${authority}` : ''}${href.pathname ?? ''}${query ? `?${query}` : ''}${href.hash ? (href.hash.startsWith('#') ? href.hash : `#${href.hash}`) : ''}`;
}

/** The application guard runs only for an ordinary, same-origin client navigation. */
export function useNavigationClick(
  { href, replace, scroll, target, download, onNavigate }: NavigationOptions,
  onClick?: MouseEventHandler<HTMLElement>,
): NonNullable<AriaLinkProps['onClick']> {
  const handleNavigationIntent = useNavigationIntentHandler();
  return useCallback(
    (event) => {
      if (!(event.currentTarget instanceof HTMLAnchorElement)) {
        return;
      }
      onClick?.(event as MouseEvent<HTMLElement>);
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        (target && target !== '_self') ||
        download !== undefined
      ) {
        return;
      }
      const anchor = event.currentTarget;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) {
        return;
      }
      onNavigate?.({ preventDefault: () => event.preventDefault() });
      if (event.defaultPrevented) {
        return;
      }
      handleNavigationIntent?.(
        {
          href: destination.href,
          ...(replace === undefined ? {} : { replace }),
          ...(scroll === undefined ? {} : { scroll }),
        },
        { preventDefault: () => event.preventDefault() },
      );
    },
    [href, replace, scroll, target, download, onNavigate, onClick, handleNavigationIntent],
  );
}

/** Match Next's prefetch intent without prefetching every offscreen/hidden list item. */
export function useNavigationPrefetchHandlers(
  { href, prefetch, target, download }: Pick<NavigationOptions, 'href' | 'prefetch' | 'target' | 'download'>,
  handlers: Pick<import('../control-props').ControlNativeProps, 'onMouseEnter' | 'onFocus'>,
) {
  const prefetchHref = useNavigationPrefetch();
  const prepare = () => {
    if (!prefetchHref || prefetch === false || (target && target !== '_self') || download !== undefined) {
      return;
    }
    const destination = new URL(navigationHref(href), window.location.href);
    if (destination.origin === window.location.origin) {
      prefetchHref(`${destination.pathname}${destination.search}`);
    }
  };
  return {
    onMouseEnter: (event: import('react').MouseEvent<HTMLElement>) => {
      handlers.onMouseEnter?.(event);
      prepare();
    },
    onFocus: (event: import('react').FocusEvent<Element>) => {
      if (event.currentTarget instanceof HTMLElement) {
        handlers.onFocus?.(event as import('react').FocusEvent<HTMLElement>);
      }
      prepare();
    },
  };
}
