// @vitest-environment jsdom
import { act } from 'react';
import { MantineProvider } from '@mantine/core';
import { PageAccessSettings } from './PageAccessSettings';
import { createRoot, type Root } from 'react-dom/client';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PAGE_ACCESS_POLICY } from '@/lib/types/page-access';
import { type PageNeutralConfiguration, usePageNeutralConfiguration } from './usePageNeutralConfiguration';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: () => {} });

vi.mock('@/lib/contexts/EditorRuntimeContext', () => ({
  useOptionalEditorRuntimeContext: () => null,
}));

type ProviderEvent = 'stateless' | 'synced';
type ProviderPayload = { payload?: string; state?: boolean };
type ProviderListener = (payload: ProviderPayload) => void;
type TestProvider = HocuspocusProvider & {
  on: ReturnType<typeof vi.fn<(event: ProviderEvent, listener: ProviderListener) => void>>;
  off: ReturnType<typeof vi.fn<(event: ProviderEvent, listener: ProviderListener) => void>>;
  emit: (event: ProviderEvent, payload: ProviderPayload) => void;
};

function createProvider(): TestProvider {
  const listeners = new Map<ProviderEvent, Set<ProviderListener>>();
  return {
    on: vi.fn((event: ProviderEvent, listener: ProviderListener) => {
      const entries = listeners.get(event) ?? new Set<ProviderListener>();
      entries.add(listener);
      listeners.set(event, entries);
    }),
    off: vi.fn((event: ProviderEvent, listener: ProviderListener) => {
      listeners.get(event)?.delete(listener);
    }),
    emit(event: ProviderEvent, payload: ProviderPayload) {
      for (const listener of listeners.get(event) ?? []) {
        listener(payload);
      }
    },
  } as unknown as TestProvider;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function config(overrides: Partial<PageNeutralConfiguration> = {}): PageNeutralConfiguration {
  return { slug: 'initial', showTitle: false, status: 'draft', accessPolicy: DEFAULT_PAGE_ACCESS_POLICY, ...overrides };
}

let root: Root;
let host: HTMLDivElement;
let current: ReturnType<typeof usePageNeutralConfiguration>;

function HookHarness(props: Parameters<typeof usePageNeutralConfiguration>[0]) {
  current = usePageNeutralConfiguration(props);
  return null;
}

function AccessHarness(props: Parameters<typeof usePageNeutralConfiguration>[0]) {
  const neutral = usePageNeutralConfiguration(props);
  return (
    <MantineProvider env="test">
      <PageAccessSettings value={neutral.configuration.accessPolicy} tagOptions={[]} onSave={neutral.saveAccess} />
    </MantineProvider>
  );
}

function emitHint(provider: TestProvider, document: string) {
  provider.emit('stateless', {
    payload: JSON.stringify({ kind: 'editor.entity_changed', version: 1, document }),
  });
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('usePageNeutralConfiguration', () => {
  it('adopts only matching peer refreshes and ignores stale reads while preserving local drafts', async () => {
    const provider = createProvider();
    const staleRead = deferred<{ ok: true } & PageNeutralConfiguration>();
    const peerRead = deferred<{ ok: true } & PageNeutralConfiguration>();
    const loadConfiguration = vi.fn().mockReturnValueOnce(staleRead.promise).mockReturnValueOnce(peerRead.promise);

    act(() =>
      root.render(
        <HookHarness
          pageId="page-1"
          initialConfiguration={config()}
          provider={provider}
          loadConfiguration={loadConfiguration}
        />,
      ),
    );
    expect(loadConfiguration).toHaveBeenCalledExactlyOnceWith('page-1');

    act(() => {
      current.setDraft('slug', 'local-slug');
      current.setDraft('showTitle', true);
    });
    act(() => emitHint(provider, 'page:other'));
    expect(loadConfiguration).toHaveBeenCalledTimes(1);
    act(() => emitHint(provider, 'page:page-1'));
    expect(loadConfiguration).toHaveBeenCalledTimes(2);

    await act(async () => {
      peerRead.resolve({ ok: true, ...config({ slug: 'peer-slug', status: 'published' }) });
      await peerRead.promise;
    });
    expect(current.configuration).toEqual(config({ slug: 'local-slug', showTitle: true, status: 'published' }));

    await act(async () => {
      staleRead.resolve({ ok: true, ...config({ slug: 'stale-slug' }) });
      await staleRead.promise;
    });
    expect(current.configuration).toEqual(config({ slug: 'local-slug', showTitle: true, status: 'published' }));
  });

  it('keeps a write pending across peer refresh and adopts its canonical acknowledgment', async () => {
    const provider = createProvider();
    const loadConfiguration = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, ...config() })
      .mockResolvedValueOnce({
        ok: true,
        ...config({ slug: 'other-tab-slug', status: 'published' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        ...config({ slug: 'canonical-slug', status: 'published' }),
      })
      .mockResolvedValue({ ok: true, ...config({ slug: 'canonical-slug', status: 'published' }) });

    act(() =>
      root.render(
        <HookHarness
          pageId="page-1"
          initialConfiguration={config()}
          provider={provider}
          loadConfiguration={loadConfiguration}
        />,
      ),
    );
    await act(async () => Promise.resolve());

    act(() => current.setDraft('slug', 'submitted-slug'));
    const slugWrite = current.beginFieldWrite('slug');
    const statusWrite = current.beginFieldWrite('status');
    act(() => emitHint(provider, 'page:page-1'));
    await act(async () => Promise.resolve());
    expect(current.configuration.slug).toBe('submitted-slug');
    expect(current.configuration.status).toBe('draft');
    expect(loadConfiguration).toHaveBeenCalledTimes(2);

    act(() => {
      slugWrite.acknowledge('canonical-slug');
      statusWrite.acknowledge('published');
    });
    await act(async () => Promise.resolve());
    expect(current.configuration.slug).toBe('canonical-slug');
    expect(current.configuration.status).toBe('published');
    expect(current.isDraft('slug')).toBe(false);
  });

  it('isolates acknowledgments and failures from an earlier A-B-A page visit', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    let pageAConfiguration = config({ slug: 'a-server' });
    const loadConfiguration = vi.fn(async (id: string) => ({
      ok: true as const,
      ...(id === 'page-a' ? pageAConfiguration : config({ slug: 'b-server' })),
    }));

    act(() =>
      root.render(
        <HookHarness
          pageId="page-a"
          initialConfiguration={config({ slug: 'a-initial' })}
          loadConfiguration={loadConfiguration}
        />,
      ),
    );
    await act(async () => Promise.resolve());
    const staleAcknowledgment = current.beginFieldWrite('status');
    const staleFailure = current.beginFieldWrite('slug');

    act(() =>
      root.render(
        <HookHarness
          pageId="page-b"
          initialConfiguration={config({ slug: 'b-initial' })}
          loadConfiguration={loadConfiguration}
        />,
      ),
    );
    await act(async () => Promise.resolve());
    act(() =>
      root.render(
        <HookHarness
          pageId="page-a"
          initialConfiguration={config({ slug: 'a-returned' })}
          loadConfiguration={loadConfiguration}
        />,
      ),
    );
    await act(async () => Promise.resolve());

    act(() => {
      current.setDraft('slug', 'a-new-draft');
      current.setDraft('showTitle', true);
    });
    const currentSlugWrite = current.beginFieldWrite('slug');
    const currentStatusWrite = current.beginFieldWrite('status');
    const loadCountBeforeStaleCompletion = loadConfiguration.mock.calls.length;

    act(() => staleFailure.fail());
    expect(loadConfiguration).toHaveBeenCalledTimes(loadCountBeforeStaleCompletion);
    act(() => staleAcknowledgment.acknowledge('published'));
    expect(loadConfiguration).toHaveBeenCalledTimes(loadCountBeforeStaleCompletion);
    expect(current.configuration).toEqual(config({ slug: 'a-new-draft', showTitle: true, status: 'draft' }));
    expect(current.isDraft('slug')).toBe(true);
    expect(current.isDraft('showTitle')).toBe(true);

    pageAConfiguration = config({ slug: 'a-committed', showTitle: true, status: 'published' });
    act(() => {
      currentSlugWrite.acknowledge('a-committed');
      currentStatusWrite.acknowledge('published');
    });
    await act(async () => Promise.resolve());
    expect(current.configuration).toEqual(config({ slug: 'a-committed', showTitle: true, status: 'published' }));
    expect(current.isDraft('slug')).toBe(false);
    expect(current.isDraft('showTitle')).toBe(false);
  });

  it('preserves access writes through peer refresh, adopts canonical policy, and keeps retryable failures local', async () => {
    const provider = createProvider();
    const policy = { ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'conditions' as const, roles: ['author' as const] };
    const canonicalPolicy = { ...policy, roles: ['author' as const, 'admin' as const] };
    const write = deferred<{ ok: true; accessPolicy: typeof canonicalPolicy }>();
    const saveAccessPolicy = vi
      .fn()
      .mockReturnValueOnce(write.promise)
      .mockResolvedValueOnce({ ok: false, error: 'Permission changed', errorCode: 7 });
    let remote = config();
    const loadConfiguration = vi.fn(async () => ({ ok: true as const, ...remote }));
    act(() =>
      root.render(
        <HookHarness
          pageId="page-1"
          initialConfiguration={config()}
          provider={provider}
          loadConfiguration={loadConfiguration}
          saveAccessPolicy={saveAccessPolicy}
        />,
      ),
    );
    await act(async () => Promise.resolve());
    let saving!: ReturnType<typeof current.saveAccess>;
    act(() => {
      saving = current.saveAccess(policy);
    });
    remote = config({ accessPolicy: { ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'authenticated' } });
    act(() => emitHint(provider, 'page:page-1'));
    await act(async () => Promise.resolve());
    expect(current.configuration.accessPolicy).toEqual(DEFAULT_PAGE_ACCESS_POLICY);
    remote = config({ accessPolicy: canonicalPolicy });
    await act(async () => {
      write.resolve({ ok: true, accessPolicy: canonicalPolicy });
      await saving;
    });
    expect(saveAccessPolicy).toHaveBeenCalledWith('page-1', policy);
    expect(current.configuration.accessPolicy).toEqual(canonicalPolicy);
    await act(async () => {
      await expect(current.saveAccess(DEFAULT_PAGE_ACCESS_POLICY)).resolves.toMatchObject({
        ok: false,
        error: 'Permission changed',
      });
    });
    expect(current.configuration.accessPolicy).toEqual(canonicalPolicy);
  });

  it('saves through the actual access controls and shows canonical controls after the neutral acknowledgment', async () => {
    const canonical = {
      ...DEFAULT_PAGE_ACCESS_POLICY,
      mode: 'conditions' as const,
      match: 'all' as const,
      roles: ['author' as const, 'admin' as const],
    };
    const initial = config();
    const saveAccessPolicy = vi.fn(async () => ({ ok: true as const, accessPolicy: canonical }));
    let remote = initial;
    const loadConfiguration = vi.fn(async () => ({ ok: true as const, ...remote }));
    act(() =>
      root.render(
        <AccessHarness
          pageId="page-1"
          initialConfiguration={initial}
          loadConfiguration={loadConfiguration}
          saveAccessPolicy={saveAccessPolicy}
        />,
      ),
    );
    await act(async () => Promise.resolve());
    const authorLabel = [...host.querySelectorAll<HTMLLabelElement>('label')].find(
      (label) => label.textContent === 'roleAuthor',
    )!;
    act(() => document.getElementById(authorLabel.htmlFor)!.click());
    remote = config({ accessPolicy: canonical });
    const save = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === 'save',
    )!;
    await act(async () => save.click());
    expect(saveAccessPolicy).toHaveBeenCalledWith('page-1', {
      ...DEFAULT_PAGE_ACCESS_POLICY,
      mode: 'conditions',
      roles: ['author'],
    });
    const userLabel = [...host.querySelectorAll<HTMLLabelElement>('label')].find(
      (label) => label.textContent === 'roleAdmin',
    )!;
    expect(document.getElementById(userLabel.htmlFor)).toBeChecked();
    expect(host.querySelector('[role="status"]')).toHaveTextContent('saved');
    expect(
      [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'save'),
    ).toBeDisabled();
  });

  it('recognizes equal access-policy drafts by value during canonical refresh', async () => {
    const provider = createProvider();
    const policy = { ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'conditions' as const, userTagIds: ['tag-1'] };
    const loadConfiguration = vi.fn().mockResolvedValue({ ok: true, ...config({ accessPolicy: policy }) });
    act(() =>
      root.render(
        <HookHarness
          pageId="page-1"
          initialConfiguration={config()}
          provider={provider}
          loadConfiguration={loadConfiguration}
        />,
      ),
    );
    await act(async () => Promise.resolve());
    act(() => current.setDraft('accessPolicy', { ...policy, userTagIds: ['tag-1'] }));
    expect(current.isDraft('accessPolicy')).toBe(false);
    act(() => current.setDraft('accessPolicy', { ...policy, userTagIds: ['local-tag'] }));
    act(() => emitHint(provider, 'page:page-1'));
    await act(async () => Promise.resolve());
    expect(current.configuration.accessPolicy.userTagIds).toEqual(['local-tag']);
  });

  it('retries failed show-title writes automatically and adopts the acknowledged value', async () => {
    vi.useFakeTimers();
    const saveShowTitle = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({ ok: true, success: true, showTitle: true });
    const loadConfiguration = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, ...config() })
      .mockResolvedValue({ ok: true, ...config({ showTitle: true }) });
    const onShowTitleSaveError = vi.fn();

    act(() =>
      root.render(
        <HookHarness
          pageId="page-1"
          initialConfiguration={config()}
          loadConfiguration={loadConfiguration}
          saveShowTitle={saveShowTitle}
          onShowTitleSaveError={onShowTitleSaveError}
        />,
      ),
    );
    await act(async () => Promise.resolve());

    act(() => {
      current.setDraft('showTitle', true);
      current.queueShowTitle(true);
    });
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(saveShowTitle).toHaveBeenCalledTimes(1);
    expect(onShowTitleSaveError).toHaveBeenCalledExactlyOnceWith('temporary failure');

    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(saveShowTitle).toHaveBeenCalledTimes(2);
    expect(current.configuration.showTitle).toBe(true);
    expect(current.isDraft('showTitle')).toBe(false);
  });
});
