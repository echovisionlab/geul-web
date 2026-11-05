// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act, type ComponentProps } from 'react';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  TranslationEntityType,
  type TranslationEntry,
  type TranslationLocale,
} from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import koMessages from '@/messages/ko.json';
import { EntityTranslationsPanel } from './EntityTranslationsPanel';

const mocks = vi.hoisted(() => ({
  listTranslationLocales: vi.fn(),
  listEntityTranslations: vi.fn(),
  setEntitySourceLocale: vi.fn(),
  routerReplace: vi.fn(),
  openConfirmModal: vi.fn(),
  notificationShow: vi.fn(),
  persistNow: vi.fn(),
  getBlockRoomSnapshot: vi.fn(),
  flushEditorSaves: vi.fn(),
  mutateTargetTranslation: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.routerReplace }),
  usePathname: () => '/posts/post-1',
  useSearchParams: () => new URLSearchParams('edit=true&tab=translations'),
}));

vi.mock('@/lib/api/browser/secure-translation', () => ({
  createTranslationClient: () => ({
    listTranslationLocales: mocks.listTranslationLocales,
    listEntityTranslations: mocks.listEntityTranslations,
    setEntitySourceLocale: mocks.setEntitySourceLocale,
  }),
}));

vi.mock('@/lib/ai/document-client', () => ({
  mutateAIDocumentTargetTranslation: mocks.mutateTargetTranslation,
}));

vi.mock('@/components/core/Modal/confirm-dialogs', () => ({
  confirmDialogs: { open: mocks.openConfirmModal },
}));

vi.mock('@/components/core/Notification', () => ({
  notifications: { show: mocks.notificationShow },
}));

vi.mock('@mantine/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mantine/hooks')>()),
  useMounted: () => true,
}));

vi.mock('@/lib/contexts/EditorRuntimeContext', () => ({
  useOptionalEditorRuntimeContext: () => ({
    provider: null,
    entityType: 'post',
    entityId: 'post-1',
    persistNow: mocks.persistNow,
    getBlockRoomSnapshot: mocks.getBlockRoomSnapshot,
    getContributorMemberIds: () => ['33333333-3333-4333-8333-333333333333'],
    subscribeToRuntimeEvents: () => () => undefined,
  }),
}));

vi.mock('@/lib/editor/editor-save-registry', () => ({
  flushEditorSaves: mocks.flushEditorSaves,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});

const TARGET = { entityType: TranslationEntityType.POST, entityId: 'post-1' };
const ENABLED_LOCALES = ['en', 'fr', 'ja'].map(
  (code) => ({ code, enabled: true, public: true }) as unknown as TranslationLocale,
);

function entry(locale: string): TranslationEntry {
  return {
    locale,
    contentText: `${locale} body`,
  } as unknown as TranslationEntry;
}

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

beforeEach(() => {
  mocks.listTranslationLocales.mockResolvedValue({ locales: ENABLED_LOCALES });
  mocks.listEntityTranslations.mockResolvedValue({
    sourceLocale: 'en',
    entries: [entry('fr')],
  });
  mocks.setEntitySourceLocale.mockResolvedValue({});
  mocks.persistNow.mockResolvedValue(undefined);
  mocks.getBlockRoomSnapshot.mockResolvedValue({ documentRevision: '22222222-2222-4222-8222-222222222222' });
  mocks.flushEditorSaves.mockResolvedValue(true);
  mocks.mutateTargetTranslation.mockResolvedValue(undefined);

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  act(() => root.unmount());
  queryClient.clear();
  container.remove();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

function renderPanel(options?: Partial<ComponentProps<typeof EntityTranslationsPanel>>) {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="ko" messages={koMessages}>
        <QueryClientProvider client={queryClient}>
          <DesignSystemProvider locale="ko" forceColorScheme="light">
            <EntityTranslationsPanel entityType="post" entityId="post-1" canManage collapsible={false} {...options} />
          </DesignSystemProvider>
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );
  });
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();
  });
}

async function renderReady(options?: Partial<ComponentProps<typeof EntityTranslationsPanel>>) {
  renderPanel(options);
  const action = options?.canMutateTargets === false ? 'preview' : 'edit';
  await act(async () => {
    await vi.waitFor(() => {
      expect(document.getElementById(`entity-translations-panel-${action}-fr`)).not.toBeNull();
    });
  });
}

async function click(id: string) {
  const button = document.getElementById(id) as HTMLButtonElement | null;
  if (!button) {
    throw new Error(`Missing button ${id}`);
  }
  await act(async () => button.click());
  await settle();
}

describe('EntityTranslationsPanel API commands', () => {
  it('shows the source-locale picker and marks only missing targets', async () => {
    mocks.listEntityTranslations.mockResolvedValue({
      sourceLocale: 'en',
      entries: [entry('fr')],
    });
    await renderReady();

    expect(container.textContent).not.toContain('오래됨');
    expect(container.querySelector('[data-testid="translation-locale-row-en"]')).toBeNull();
    expect(container.querySelector('label[for]')?.textContent).toContain('원문 언어');
    expect(container.querySelector('[data-testid="translation-locale-row-fr"]')?.textContent).not.toContain('기존');
    expect(container.querySelector('[data-testid="translation-locale-row-fr"]')?.textContent).not.toMatch(/\bFR\b/);
    expect(container.querySelector('[data-testid="translation-locale-row-ja"]')?.textContent).not.toMatch(/\bJA\b/);
    expect([...container.querySelectorAll('option')].map((option) => option.textContent)).not.toContain('English (EN)');
    expect(container.querySelector('[data-testid="translation-locale-row-fr"]')?.textContent).not.toContain(
      '대상 문서가 아직 없습니다',
    );
    expect(container.querySelector('[data-testid="translation-locale-row-ja"]')?.textContent).toContain(
      '대상 문서가 아직 없습니다',
    );
  });

  it('opens an existing target locale editor route without mutating translation state', async () => {
    await renderReady({ canAdministerTranslations: false, canMutateTargets: false });
    expect(container.querySelector<HTMLSelectElement>('select')?.disabled).toBe(true);
    expect(container.querySelector<HTMLSelectElement>('select')?.value).toBe('en');

    await click('entity-translations-panel-preview-fr');

    expect(mocks.routerReplace).toHaveBeenCalledWith('/posts/post-1?edit=true&tab=translations&lang=fr', {
      scroll: false,
    });
    expect(mocks.setEntitySourceLocale).not.toHaveBeenCalled();
    expect(document.querySelector('textarea')).toBeNull();
  });

  it.each([
    { locale: 'fr', existing: true },
    { locale: 'ja', existing: false },
  ])('opens the exact $locale target editor (existing: $existing)', async ({ locale, existing }) => {
    await renderReady({ canAdministerTranslations: false });

    await click(`entity-translations-panel-edit-${locale}`);

    if (existing) {
      expect(mocks.mutateTargetTranslation).not.toHaveBeenCalled();
    } else {
      expect(mocks.mutateTargetTranslation).toHaveBeenCalledWith({
        target: { type: 'post', id: 'post-1', locale },
        action: 'create',
      });
      expect(mocks.listEntityTranslations.mock.calls.length).toBeGreaterThanOrEqual(2);
    }
    expect(mocks.routerReplace).toHaveBeenCalledWith(`/posts/post-1?edit=true&tab=translations&lang=${locale}`, {
      scroll: false,
    });
  });

  it('deletes an existing target only after explicit confirmation', async () => {
    await renderReady({ canAdministerTranslations: false });

    await click('entity-translations-panel-delete-fr');

    expect(mocks.openConfirmModal).toHaveBeenCalledTimes(1);
    expect(mocks.mutateTargetTranslation).not.toHaveBeenCalled();
    await act(async () => mocks.openConfirmModal.mock.calls[0]?.[0].onConfirm());
    await settle();

    expect(mocks.mutateTargetTranslation).toHaveBeenCalledWith({
      target: { type: 'post', id: 'post-1', locale: 'fr' },
      action: 'delete',
    });
  });

  it('keeps a failed missing-target create out of the target route and hides raw RPC detail', async () => {
    mocks.mutateTargetTranslation.mockRejectedValue(new ConnectError('raw create detail', Code.Internal));
    await renderReady({ canAdministerTranslations: false });

    await click('entity-translations-panel-edit-ja');

    expect(mocks.routerReplace).not.toHaveBeenCalled();
    expect(mocks.notificationShow).toHaveBeenCalledWith({
      tone: 'danger',
      message: koMessages.common.notifications.updateFailed,
    });
    expect(container.textContent).not.toContain('raw create detail');
  });

  it('confirms the source-locale switch and sends its document revision CAS', async () => {
    await renderReady();
    const select = document.querySelector('select') as HTMLSelectElement;

    await act(async () => {
      select.value = 'fr';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(mocks.openConfirmModal).toHaveBeenCalledTimes(1);
    const confirmation = mocks.openConfirmModal.mock.calls[0]?.[0];
    const confirmationText = renderToStaticMarkup(
      <DesignSystemProvider forceColorScheme="light">{confirmation.message}</DesignSystemProvider>,
    );
    expect(confirmationText).toContain('원문 언어');
    await act(async () => confirmation.onConfirm());
    await settle();

    expect(mocks.setEntitySourceLocale).toHaveBeenCalledWith({
      target: TARGET,
      sourceLocale: 'fr',
      expectedDocumentRevision: '22222222-2222-4222-8222-222222222222',
    });
    expect(mocks.routerReplace).toHaveBeenCalledWith('/posts/post-1?edit=true&tab=translations&lang=fr');
    expect(mocks.listEntityTranslations.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
