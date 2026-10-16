import { afterEach, beforeEach, vi } from 'vitest';

interface BrowserNavigation {
  href: string;
  target: string;
  download: string | null;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/** Replace the browser's document-loading boundary after application click handlers. */
export function mockBrowserNavigation() {
  const navigate = vi.fn<(navigation: BrowserNavigation) => void>();
  const containers = new Set<HTMLElement>();
  const handleClick = (event: MouseEvent) => {
    if (event.defaultPrevented || !(event.target instanceof Element)) {
      return;
    }
    const link = event.target.closest<HTMLAnchorElement>('a[href]');
    if (!link) {
      return;
    }
    navigate({
      href: link.href,
      target: link.target,
      download: link.getAttribute('download'),
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
    });
    event.preventDefault();
  };
  beforeEach(() => navigate.mockClear());
  afterEach(() => {
    for (const container of containers) {
      container.removeEventListener('click', handleClick);
    }
    containers.clear();
  });
  return {
    navigate,
    attach(container: HTMLElement) {
      container.addEventListener('click', handleClick);
      containers.add(container);
    },
  };
}
