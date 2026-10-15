// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { AdminMenusPage } from './AdminMenusPage';

const room = vi.hoisted(() => ({
  provider: {},
  isConnected: true,
  isSynced: true,
  roomState: {
    locale: 'en',
    sourceLocale: 'en',
    localeExists: true,
    name: 'Main menu',
    items: [{ id: 'item-1', label: 'Readable link', linkType: 'custom', url: '/read' }],
    requestedLabels: {},
  },
  replaceSource: vi.fn(),
  setLabel: vi.fn(),
  useSourceLabel: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('menu=menu-1') }));
vi.mock('next-intl', () => ({ useTranslations: () => Object.assign((key: string) => key, { rich: () => null }) }));
vi.mock('./useMenuCollaboration', () => ({ useMenuCollaboration: () => room }));
vi.mock('@/features/translation/useLocaleDocumentSession', () => ({
  useLocaleDocumentSession: () => ({
    roomLocale: 'en',
    activeEditLocale: {
      activeLocale: 'en',
      sourceLocale: 'en',
      canEditActiveLocale: true,
      isSourceLocale: true,
      hasLiveRow: true,
    },
  }),
}));
vi.mock('@/lib/queries/menu-browser', () => ({
  listMenus: async () => [{ id: 'menu-1', name: 'Main menu', items: room.roomState.items }],
  getMenuById: async () => ({ id: 'menu-1', name: 'Main menu', items: room.roomState.items }),
}));
vi.mock('@/lib/actions/menu', () => ({
  createMenuAction: vi.fn(),
  deleteMenuAction: vi.fn(),
  getMenuAvailableTargetsAction: vi.fn(),
}));
vi.mock('@/lib/contexts/EditorRuntimeContext', () => ({
  EditorRuntimeProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/features/translation/EditorActiveLocaleControl', () => ({ EditorActiveLocaleControl: () => null }));
vi.mock('@/features/translation/EntityTranslationsPanel', () => ({
  EntityTranslationsPanel: () => <p>Translations</p>,
}));
vi.mock('./MenuItemsEditor', () => ({
  SortableMenuItem: ({ item, editable }: { item: { label: string }; editable: boolean }) => (
    <article>
      <p>{item.label}</p>
      <button type="button" disabled={!editable}>
        Edit link
      </button>
    </article>
  ),
}));

it('upgrades and downgrades item edits without replacing the mounted menu', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  setProviderAccessLevel(room.provider, 'view');
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <DesignSystemProvider forceColorScheme="light">
            <AdminMenusPage />
          </DesignSystemProvider>
        </QueryClientProvider>,
      ),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const content = container.querySelector('article');
    expect(content?.textContent).toContain('Readable link');
    const edit = content?.querySelector('button');
    expect(edit?.disabled).toBe(true);
    act(() => setProviderAccessLevel(room.provider, 'edit'));
    expect(edit?.disabled).toBe(false);
    expect(container.querySelector('article')).toBe(content);
    act(() => setProviderAccessLevel(room.provider, 'view'));
    expect(edit?.disabled).toBe(true);
    expect(container.querySelector('article')).toBe(content);
  } finally {
    act(() => root.unmount());
    client.clear();
    container.remove();
  }
});
