import type { ReactNode } from 'react';
import classes from './StorybookLink.module.css';

/** Preserve toolbar context when an iframe document opens another manager entry. */
export function storybookHref(href: string, currentUrl: string) {
  if (!href.startsWith('/?path=') && !href.startsWith('?path=')) {
    return href;
  }
  const current = new URL(currentUrl);
  const destination = new URL(href, current);
  if (!destination.searchParams.has('globals') && current.searchParams.has('globals')) {
    destination.searchParams.set('globals', current.searchParams.get('globals') ?? '');
  }
  return `${destination.pathname}${destination.search}${destination.hash}`;
}

export function StorybookLink({ href, children }: { href: string; children: ReactNode }) {
  let currentUrl = 'http://storybook.local/';
  if (typeof window !== 'undefined') {
    try {
      currentUrl = window.parent.location.href;
    } catch {
      currentUrl = window.location.href;
    }
  }
  return (
    <a
      className={classes.link}
      href={storybookHref(href, currentUrl)}
      target="_top"
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          (!href.startsWith('/?path=') && !href.startsWith('?path='))
        ) {
          return;
        }
        event.preventDefault();
        window.parent.location.assign(new URL(storybookHref(href, currentUrl), currentUrl).toString());
      }}
    >
      {children}
    </a>
  );
}
