// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { act, render, screen } from '@/test/render';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';
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
vi.mock('next-intl', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next-intl')>()),
  useTranslations: () =>
    Object.assign((key: string, values?: { locale: string }) => (values?.locale ? `${key} (${values.locale})` : key), {
      rich: () => null,
    }),
}));
vi.mock('./useMenuCollaboration', () => ({ useMenuCollaboration: () => room }));
const selection = vi.hoisted(() => ({
  activeLocale: 'en',
  sourceLocale: 'en',
  isSourceLocale: true,
  hasLiveRow: true,
  isSourceLocaleReady: true,
}));
vi.mock('@/features/translation/useLocaleDocumentSession', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/translation/useLocaleDocumentSession')>();
  return {
    ...actual,
    useLocaleDocumentSession: () => ({
      ...actual.resolveLocaleDocumentSession(selection),
      activeEditLocale: {
        ...selection,
        canEditActiveLocale: selection.hasLiveRow,
        isControlVisible: true,
        isLoading: false,
        localeChanging: false,
        localeOptions: [
          { value: 'en', label: 'English' },
          { value: 'ko', label: '한국어' },
        ],
        setActiveLocale: vi.fn(),
      },
    }),
  };
});
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

afterEach(() => {
  Object.assign(selection, { activeLocale: 'en', isSourceLocale: true, hasLiveRow: true });
  room.roomState.locale = 'en';
});

function scenario() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <AdminMenusPage />
    </QueryClientProvider>,
  );
  return {
    ...view,
    dispose: () => {
      view.unmount();
      client.clear();
    },
  };
}

it('upgrades and downgrades item edits without replacing the mounted menu', async () => {
  setProviderAccessLevel(room.provider, 'view');
  const view = scenario();
  try {
    const edit = await screen.findByRole('button', { name: 'Edit link' });
    expect(await screen.findByText('Readable link')).toBeVisible();
    expect(edit).toBeDisabled();
    act(() => setProviderAccessLevel(room.provider, 'edit'));
    expect(edit).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Edit link' })).toBe(edit);
    act(() => setProviderAccessLevel(room.provider, 'view'));
    expect(edit).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit link' })).toBe(edit);
  } finally {
    view.dispose();
  }
});

it.each([false, true])(
  'renders a resolved translation with hasLiveRow=%s without confusing source fallback with the selected language',
  async (hasLiveRow) => {
    Object.assign(selection, { activeLocale: 'ko', isSourceLocale: false, hasLiveRow });
    room.roomState.locale = hasLiveRow ? 'ko' : 'en';
    setProviderAccessLevel(room.provider, 'edit');
    const view = scenario();
    try {
      const label = await screen.findByRole('textbox', { name: 'localizedLabelForLocale (ko)' });
      expect(label).toHaveValue('Readable link');
      if (hasLiveRow) {
        expect(label).toBeEnabled();
      } else {
        expect(label).toBeDisabled();
      }
      expect(screen.queryByText('states.connectingEditor')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /한국어/ })).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Edit link' })).not.toBeInTheDocument();
    } finally {
      view.dispose();
    }
  },
);
