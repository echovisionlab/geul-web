import { useLayoutEffect, type ReactNode } from 'react';
import { getRouter as getAppRouter } from '@storybook/nextjs/navigation.mock';
import { getRouter as getPageRouter } from '@storybook/nextjs/router.mock';
import { goBackPreview, navigatePreview, resolvePreviewStory } from '../stories/shared/preview-navigation';

export function PreviewNavigation({ children, appDirectory }: { children: ReactNode; appDirectory: boolean }) {
  useLayoutEffect(() => {
    const router = appDirectory ? getAppRouter() : getPageRouter();
    const push = (href: string) => navigatePreview(href);
    const replace = (href: string) => navigatePreview(href, true);
    router.push.mockImplementation(async (href: string) => push(href));
    router.replace.mockImplementation(async (href: string) => replace(href));
    router.back.mockImplementation(goBackPreview);
    const click = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!anchor || anchor.hasAttribute('download') || anchor.target === '_blank') {
        return;
      }
      const href = anchor.getAttribute('href') ?? '';
      if (!href.startsWith('/') || href.startsWith('//') || !resolvePreviewStory(href)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      navigatePreview(href);
    };
    document.addEventListener('click', click, true);
    return () => {
      document.removeEventListener('click', click, true);
      router.push.mockReset();
      router.replace.mockReset();
      router.back.mockReset();
    };
  }, [appDirectory]);
  return children;
}
