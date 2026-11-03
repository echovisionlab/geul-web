'use client';

import { useRef, useTransition, type ReactNode } from 'react';
import { useNavigationIntentHandler } from '@/components/core/Navigation/NavigationIntentProvider';
import { useServerTablePending, useServerTableRouter } from './ServerDataTableNavigation';

/** Keeps server-rendered pagination links while tracking their client navigation. */
export function ServerDataTablePaginationNavigation({
  children,
  onNavigate,
}: {
  children: ReactNode;
  onNavigate?: (href: string) => void | Promise<void>;
}) {
  const router = useServerTableRouter();
  const navigationIntent = useNavigationIntentHandler();
  const ref = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  useServerTablePending(ref, pending);
  return (
    <div
      ref={ref}
      aria-busy={pending}
      onClickCapture={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        if (!(event.target instanceof Element)) {
          return;
        }
        const anchor = event.target.closest('a[href]');
        if (
          !(anchor instanceof HTMLAnchorElement) ||
          (anchor.target && anchor.target !== '_self') ||
          anchor.hasAttribute('download')
        ) {
          return;
        }
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) {
          return;
        }
        if (!onNavigate) {
          let cancelled = false;
          navigationIntent?.(
            { href: url.href, scroll: false },
            {
              preventDefault: () => {
                cancelled = true;
              },
            },
          );
          if (cancelled) {
            event.preventDefault();
            return;
          }
        }
        event.preventDefault();
        if (pending) {
          return;
        }
        startTransition(async () => {
          const href = `${url.pathname}${url.search}${url.hash}`;
          if (onNavigate) {
            await onNavigate(anchor.getAttribute('href') ?? href);
          } else {
            await router.push(href, { scroll: false });
          }
        });
      }}
    >
      {children}
    </div>
  );
}
