'use client';

import NextLink, { type LinkProps as NextLinkNativeProps } from 'next/link';
import { forwardRef, useCallback, useRef, type ComponentProps, type ForwardedRef } from 'react';
import { useNavigationIntentHandler } from './NavigationIntentProvider';

export type LinkProps = ComponentProps<typeof NextLink>;
export type NextLinkProps = NextLinkNativeProps;

type OnNavigateEvent = NonNullable<NextLinkNativeProps['onNavigate']> extends (event: infer T) => void ? T : never;

function setRef(ref: ForwardedRef<HTMLAnchorElement>, anchor: HTMLAnchorElement | null) {
  if (typeof ref === 'function') {
    ref(anchor);
  } else if (ref) {
    ref.current = anchor;
  }
}

const NavigationLink = forwardRef<HTMLAnchorElement, LinkProps>((props, forwardedRef) => {
  const { onNavigate, replace, scroll, ...linkProps } = props;
  const anchorRef = useRef<HTMLAnchorElement | null>(null);
  const handleNavigationIntent = useNavigationIntentHandler();

  const setAnchorRef = useCallback(
    (anchor: HTMLAnchorElement | null) => {
      anchorRef.current = anchor;
      setRef(forwardedRef, anchor);
    },
    [forwardedRef],
  );

  const handleNavigate = useCallback(
    (event: OnNavigateEvent) => {
      let userPreventedNavigation = false;
      onNavigate?.({
        preventDefault() {
          userPreventedNavigation = true;
          event.preventDefault();
        },
      });

      if (userPreventedNavigation || !handleNavigationIntent) {
        return;
      }

      const href = anchorRef.current?.href;
      if (!href) {
        return;
      }

      handleNavigationIntent(
        {
          href,
          ...(replace === undefined ? {} : { replace }),
          ...(scroll === undefined ? {} : { scroll }),
        },
        { preventDefault: () => event.preventDefault() },
      );
    },
    [handleNavigationIntent, onNavigate, replace, scroll],
  );

  return <NextLink {...linkProps} ref={setAnchorRef} replace={replace} scroll={scroll} onNavigate={handleNavigate} />;
});

NavigationLink.displayName = 'NavigationLink';

export { NavigationLink };
export default NavigationLink;
