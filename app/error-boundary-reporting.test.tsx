// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GeneralError from './(general)/error';
import AdminError from './admin/error';
import GlobalError from './global-error';
import RootError from './error';

const mocks = vi.hoisted(() => ({ report: vi.fn() }));

vi.mock('@/lib/observability/client-render-failure', () => ({
  reportClientRenderFailure: mocks.report,
}));

vi.mock('next-intl', async () => {
  const { default: errorPageMessages } = await import('@/lib/i18n/error-page-messages.json');
  return {
    useLocale: () => 'ko',
    // In-layout boundaries read the active locale's errorPage copy from the client catalogue.
    useMessages: () => ({ errorPage: errorPageMessages.ko }),
    useTranslations: () =>
      Object.assign((key: string) => key, {
        rich: (key: string) => key,
      }),
  };
});

const mountedRoots: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = [];

async function renderBoundary(element: React.ReactNode) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push({ root, container });
  await act(async () => root.render(element));
}

describe('application error boundary reporting', () => {
  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const mounted = mountedRoots.pop()!;
      await act(async () => mounted.root.unmount());
      mounted.container.remove();
    }
    mocks.report.mockReset();
  });

  it('classifies general and admin error surfaces without transforming the Error', async () => {
    const generalError = new Error('general');
    const adminError = new Error('admin');

    await renderBoundary(
      <DesignSystemProvider>
        <GeneralError error={generalError} reset={vi.fn()} />
      </DesignSystemProvider>,
    );
    await renderBoundary(
      <DesignSystemProvider>
        <AdminError error={adminError} reset={vi.fn()} />
      </DesignSystemProvider>,
    );

    expect(mocks.report).toHaveBeenCalledWith('general', generalError);
    expect(mocks.report).toHaveBeenCalledWith('admin', adminError);
  });

  it('covers routes outside the general/admin groups with the common boundary', async () => {
    const error = Object.assign(new Error('upstream'), { status: 503 });
    await renderBoundary(
      <DesignSystemProvider>
        <RootError error={error} reset={vi.fn()} />
      </DesignSystemProvider>,
    );
    expect(document.querySelector('[data-error-code]')?.getAttribute('data-error-code')).toBe('503');
    expect(mocks.report).toHaveBeenCalledWith('general', error);
  });

  it('classifies the root error surface', async () => {
    const error = new Error('global');
    await renderBoundary(<GlobalError error={error} reset={vi.fn()} />);

    expect(mocks.report).toHaveBeenCalledWith('global', error);
  });
});
