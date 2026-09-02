// @vitest-environment jsdom

import { act, type ComponentProps } from 'react';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  TranslationEntityType,
  TranslationJobSchema,
  TranslationJobStatus,
  type TranslationEntry,
  type TranslationJob,
  type TranslationLocale,
} from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import koMessages from '@/messages/ko.json';
import { EntityTranslationsPanel } from './EntityTranslationsPanel';

const mocks = vi.hoisted(() => ({
  listTranslationLocales: vi.fn(),
  listEntityTranslations: vi.fn(),
  listTranslationJobs: vi.fn(),
  getTranslationSettings: vi.fn(),
  setEntitySourceLocale: vi.fn(),
  regenerateEntityTranslations: vi.fn(),
  cancelTranslationJob: vi.fn(),
  routerReplace: vi.fn(),
  openConfirmModal: vi.fn(),
  notificationShow: vi.fn(),
  persistNow: vi.fn(),
  getBlockRoomSnapshot: vi.fn(),
  mutateTargetTranslation: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.routerReplace }),
  usePathname: () => '/posts/post-1',
  useSearchParams: () => new URLSearchParams('edit=true&tab=translations'),
}));

vi.mock('@/lib/api/browser-client', () => ({
  createTranslationClient: () => ({
    listTranslationLocales: mocks.listTranslationLocales,
    listEntityTranslations: mocks.listEntityTranslations,
    listTranslationJobs: mocks.listTranslationJobs,
    getTranslationSettings: mocks.getTranslationSettings,
    setEntitySourceLocale: mocks.setEntitySourceLocale,
    regenerateEntityTranslations: mocks.regenerateEntityTranslations,
    cancelTranslationJob: mocks.cancelTranslationJob,
  }),
}));

vi.mock('@/lib/ai/document-client', () => ({
  mutateAIDocumentTargetTranslation: mocks.mutateTargetTranslation,
}));

vi.mock('@mantine/modals', () => ({
  modals: { openConfirmModal: mocks.openConfirmModal },
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mocks.notificationShow },
}));

vi.mock('@mantine/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mantine/hooks')>()),
  useMounted: () => true,
}));

vi.mock('@/features/translation/useTranslationLifecycleSubscription', () => ({
  useTranslationLifecycleSubscription: () => undefined,
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

function job(id: string, targetLocale: string, status: TranslationJobStatus): TranslationJob {
  return create(TranslationJobSchema, { id, targetLocale, status });
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
  mocks.listTranslationJobs.mockResolvedValue({ jobs: [] });
  mocks.getTranslationSettings.mockResolvedValue({ generationEnabled: true });
  mocks.setEntitySourceLocale.mockResolvedValue({});
  mocks.regenerateEntityTranslations.mockResolvedValue({ jobIds: ['job-new'] });
  mocks.cancelTranslationJob.mockResolvedValue({});
  mocks.persistNow.mockResolvedValue(undefined);
  mocks.getBlockRoomSnapshot.mockResolvedValue({ documentRevision: '22222222-2222-4222-8222-222222222222' });
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
          <MantineProvider>
            <EntityTranslationsPanel entityType="post" entityId="post-1" canManage collapsible={false} {...options} />
          </MantineProvider>
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
  it('queues one exact locale and sends every eligible target explicitly', async () => {
    await renderReady();

    await click('entity-translations-panel-regenerate-fr');
    expect(mocks.persistNow).toHaveBeenCalledTimes(1);
    expect(mocks.regenerateEntityTranslations).toHaveBeenNthCalledWith(1, {
      target: TARGET,
      locales: ['fr'],
    });
    expect(mocks.listEntityTranslations.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mocks.listTranslationJobs.mock.calls.length).toBeGreaterThanOrEqual(2);

    await click('entity-translations-panel-regenerate-all');
    expect(mocks.regenerateEntityTranslations).toHaveBeenNthCalledWith(2, {
      target: TARGET,
      locales: ['fr', 'ja'],
    });
    expect(mocks.notificationShow).toHaveBeenCalledWith(expect.objectContaining({ color: 'blue' }));
  });

  it('keeps explicit regenerate available for an existing target and labels a missing target as generate', async () => {
    mocks.listEntityTranslations.mockResolvedValue({
      sourceLocale: 'en',
      entries: [entry('fr')],
    });
    await renderReady();

    expect((document.getElementById('entity-translations-panel-regenerate-fr') as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(document.getElementById('entity-translations-panel-regenerate-ja')?.textContent).toContain('생성');
    expect(container.textContent).not.toContain('오래됨');
    await click('entity-translations-panel-regenerate-fr');
    expect(mocks.regenerateEntityTranslations).toHaveBeenCalledWith({ target: TARGET, locales: ['fr'] });
  });

  it('starts a new regeneration and cancels the exact active job', async () => {
    mocks.listTranslationJobs.mockResolvedValue({
      jobs: [job('running-ja', 'ja', TranslationJobStatus.RUNNING)],
    });
    await renderReady();

    expect(document.getElementById('entity-translations-panel-retry-fr')).toBeNull();
    expect((document.getElementById('entity-translations-panel-regenerate-fr') as HTMLButtonElement).disabled).toBe(
      false,
    );
    await click('entity-translations-panel-regenerate-fr');
    expect(mocks.regenerateEntityTranslations).toHaveBeenCalledWith({ target: TARGET, locales: ['fr'] });

    await click('entity-translations-panel-cancel-ja');
    expect(mocks.cancelTranslationJob).toHaveBeenCalledWith({ jobId: 'running-ja' });
    expect(container.textContent).not.toContain('provider_response_invalid');
  });

  it('uses one active job row for both the badge and cancel action', async () => {
    mocks.listTranslationJobs.mockResolvedValue({
      jobs: [job('queued-ja', 'ja', TranslationJobStatus.QUEUED)],
    });
    await renderReady();

    expect((document.getElementById('entity-translations-panel-regenerate-ja') as HTMLButtonElement).disabled).toBe(
      true,
    );
    await click('entity-translations-panel-cancel-ja');
    expect(mocks.cancelTranslationJob).toHaveBeenCalledWith({ jobId: 'queued-ja' });
  });

  it('opens an existing target locale editor route without mutating translation state', async () => {
    await renderReady({ canAdministerTranslations: false, canMutateTargets: false });

    await click('entity-translations-panel-preview-fr');

    expect(mocks.routerReplace).toHaveBeenCalledWith('/posts/post-1?edit=true&tab=translations&lang=fr', {
      scroll: false,
    });
    expect(mocks.setEntitySourceLocale).not.toHaveBeenCalled();
    expect(mocks.regenerateEntityTranslations).not.toHaveBeenCalled();
    expect(mocks.cancelTranslationJob).not.toHaveBeenCalled();
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('opens an existing target directly when Post target authoring is available', async () => {
    await renderReady({ canAdministerTranslations: false });

    await click('entity-translations-panel-edit-fr');

    expect(mocks.mutateTargetTranslation).not.toHaveBeenCalled();
    expect(mocks.routerReplace).toHaveBeenCalledWith('/posts/post-1?edit=true&tab=translations&lang=fr', {
      scroll: false,
    });
  });

  it('creates a missing target before refreshing and entering its exact editor route', async () => {
    await renderReady({ canAdministerTranslations: false });

    await click('entity-translations-panel-edit-ja');

    expect(mocks.mutateTargetTranslation).toHaveBeenCalledWith({
      target: { type: 'post', id: 'post-1', locale: 'ja' },
      action: 'create',
    });
    expect(mocks.listEntityTranslations.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mocks.routerReplace).toHaveBeenCalledWith('/posts/post-1?edit=true&tab=translations&lang=ja', {
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
      color: 'red',
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
    const confirmationText = renderToStaticMarkup(<MantineProvider>{confirmation.children}</MantineProvider>);
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

  it('renders stable authorization and fallback errors without exposing raw RPC details', async () => {
    mocks.regenerateEntityTranslations
      .mockRejectedValueOnce(new ConnectError('secret upstream detail', Code.PermissionDenied))
      .mockRejectedValueOnce(new ConnectError('provider credential raw detail', Code.Internal));
    await renderReady();

    await click('entity-translations-panel-regenerate-fr');
    expect(mocks.notificationShow).toHaveBeenCalledWith({ color: 'red', message: 'Forbidden' });

    await click('entity-translations-panel-regenerate-fr');
    expect(mocks.notificationShow).toHaveBeenCalledWith({
      color: 'red',
      message: koMessages.translationPanel.notifications.regenerateFailed,
    });
    expect(container.textContent).not.toContain('secret upstream detail');
    expect(container.textContent).not.toContain('provider credential raw detail');
  });
});
