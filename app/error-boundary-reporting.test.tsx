// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GeneralError from './(general)/error';
import AdminError from './admin/error';
import GlobalError from './global-error';

const mocks = vi.hoisted(() => ({ report: vi.fn() }));

vi.mock('@/lib/observability/client-render-failure', () => ({
  reportClientRenderFailure: mocks.report,
}));

vi.mock('next-intl', () => ({
  useTranslations: () =>
    Object.assign((key: string) => key, {
      rich: (key: string) => key,
    }),
}));

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
      <MantineProvider env="test">
        <GeneralError error={generalError} reset={vi.fn()} />
      </MantineProvider>,
    );
    await renderBoundary(
      <MantineProvider env="test">
        <AdminError error={adminError} reset={vi.fn()} />
      </MantineProvider>,
    );

    expect(mocks.report).toHaveBeenCalledWith('general', generalError);
    expect(mocks.report).toHaveBeenCalledWith('admin', adminError);
  });

  it('classifies the root error surface', async () => {
    const error = new Error('global');
    await renderBoundary(<GlobalError error={error} reset={vi.fn()} />);

    expect(mocks.report).toHaveBeenCalledWith('global', error);
  });
});
