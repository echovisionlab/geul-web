// @vitest-environment jsdom

import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { getEditorWriteOrigin } from '@/lib/editor/editor-write-origin';
import { setProviderDocumentRevision } from '@/lib/collab/provider-control-state';
import { SegmentType } from '@echovisionlab/geul-proto/secure/audience_pb.ts';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { notifications } from '@/components/core/Notification';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import type {
  AudienceSegmentSummary,
  FileDownloadActionResult,
  FileDownloadPolicyModel,
  FileDownloadPolicyTarget,
} from '@/lib/types/file-download-access';
import { FileDownloadPolicyEditor, type FileDownloadPolicyEditorAdapter } from './FileDownloadPolicyEditor';

const policyRuntime = vi.hoisted(() => ({
  current: null as null | {
    entityType: 'post' | 'release';
    entityId: string;
    provider: HocuspocusProvider;
  },
}));
vi.mock('@/lib/contexts/EditorRuntimeContext', () => ({
  useOptionalEditorRuntimeContext: () => policyRuntime.current,
}));
function policyProvider() {
  const listeners = new Map<string, Set<(payload: { payload: string }) => void>>();
  return {
    on(event: string, listener: (payload: { payload: string }) => void) {
      const entries = listeners.get(event) ?? new Set();
      entries.add(listener);
      listeners.set(event, entries);
    },
    off(event: string, listener: (payload: { payload: string }) => void) {
      listeners.get(event)?.delete(listener);
    },
    emit(payload: string) {
      for (const listener of listeners.get('stateless') ?? []) {
        listener({ payload });
      }
    },
  };
}

vi.mock('@/components/core/Notification', () => ({ notifications: { show: vi.fn() } }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root | null = null;

const defaultTarget: FileDownloadPolicyTarget = {
  entityType: TranscodeEntityType.POST,
  entityId: 'post-1',
  blockId: 'block-1',
  referencePath: 'file',
  expectedFileId: 'file-1',
};

function segment(id: string, name: string, overrides: Partial<AudienceSegmentSummary> = {}): AudienceSegmentSummary {
  return {
    id,
    name,
    description: '',
    segmentType: SegmentType.MEMBERS_BY_FILTER,
    ...overrides,
  };
}

function page(items: AudienceSegmentSummary[], pageNumber = 1, hasMore = false) {
  return {
    data: {
      items,
      page: pageNumber,
      pageSize: 50,
      total: hasMore ? 51 : items.length,
      totalPages: hasMore ? 2 : 1,
      hasMore,
    },
  };
}

class TestBroadcastChannel {
  static channels: TestBroadcastChannel[] = [];
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

  constructor(readonly name: string) {
    TestBroadcastChannel.channels.push(this);
  }

  close() {}
  postMessage() {}
}

function renderEditor(
  adapter: FileDownloadPolicyEditorAdapter,
  options: {
    presentation?: 'standalone' | 'block-settings';
    strict?: boolean;
    target?: FileDownloadPolicyTarget;
    exactEcho?: boolean;
    releaseId?: string;
  } = {},
) {
  host ??= document.createElement('div');
  if (!host.isConnected) {
    document.body.appendChild(host);
  }
  root ??= createRoot(host);
  const target = options.target ?? defaultTarget;
  const echoPolicyTarget = (
    result: FileDownloadActionResult<FileDownloadPolicyModel>,
    requestTarget: FileDownloadPolicyTarget,
  ): FileDownloadActionResult<FileDownloadPolicyModel> =>
    result.data
      ? {
          data: {
            ...result.data,
            entityType: requestTarget.entityType,
            entityId: requestTarget.entityId,
            blockId: requestTarget.blockId,
            referencePath: requestTarget.referencePath,
          },
        }
      : result;
  const exactAdapter =
    options.exactEcho === false
      ? adapter
      : {
          loadPolicy: async (requestTarget: FileDownloadPolicyTarget) =>
            echoPolicyTarget(await adapter.loadPolicy(requestTarget), requestTarget),
          loadSegments: adapter.loadSegments,
          savePolicy: async (
            requestTarget: FileDownloadPolicyTarget,
            audience: Parameters<FileDownloadPolicyEditorAdapter['savePolicy']>[1],
            audienceSegmentIds: string[],
            observedPolicy: Parameters<FileDownloadPolicyEditorAdapter['savePolicy']>[3],
            editorOrigin?: string,
          ) =>
            echoPolicyTarget(
              await adapter.savePolicy(requestTarget, audience, audienceSegmentIds, observedPolicy, editorOrigin),
              requestTarget,
            ),
        };

  const editor = (
    <TestProviders>
      <FileDownloadPolicyEditor
        {...target}
        releaseId={options.releaseId}
        adapter={exactAdapter}
        presentation={options.presentation}
      />
    </TestProviders>
  );

  act(() => {
    root?.render(options.strict ? <StrictMode>{editor}</StrictMode> : editor);
  });
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function inputForLabel(label: string): HTMLInputElement {
  const labelElement = Array.from(document.body.querySelectorAll('label')).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  const input = labelElement?.htmlFor
    ? document.getElementById(labelElement.htmlFor)
    : Array.from(document.body.querySelectorAll('input')).find(
        (candidate) => candidate.getAttribute('aria-label') === label,
      );
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Missing input for ${label}`);
  }
  return input;
}

function expectSelectedAccess(label: string) {
  expect(host?.textContent).toContain(label);
}

async function selectOption(label: string, option: string) {
  const input = inputForLabel(label);
  await act(async () => {
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
    await Promise.resolve();
  });
  const optionElement = Array.from(document.body.querySelectorAll<HTMLElement>('[role="option"]')).find(
    (candidate) => candidate.textContent?.trim() === option,
  );
  if (!optionElement) {
    throw new Error(`Missing option ${option}`);
  }
  await act(async () => {
    optionElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
}

async function searchOptions(label: string, search: string) {
  const input = inputForLabel(label);
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    input.focus();
    valueSetter?.call(input, search);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
  });
}

async function flushAutosave(delay = 250) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(delay);
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.mocked(notifications.show).mockReset();
  TestBroadcastChannel.channels = [];
  policyRuntime.current = null;
  vi.stubGlobal('BroadcastChannel', TestBroadcastChannel);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = null;
  root = null;
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('FileDownloadPolicyEditor', () => {
  it('refetches the exact policy when its owning Post metadata changes', async () => {
    vi.useFakeTimers();
    const provider = policyProvider();
    const revision = '11111111-1111-4111-8111-111111111111';
    setProviderDocumentRevision(provider, revision);
    policyRuntime.current = {
      entityType: 'post',
      entityId: 'post-1',
      provider: provider as unknown as HocuspocusProvider,
    };
    const target = defaultTarget;
    const loadPolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['loadPolicy']>()
      .mockResolvedValueOnce({ data: { fileId: 'file-1', audience: 'public', audienceSegments: [] } })
      .mockResolvedValue({ data: { fileId: 'file-1', audience: 'authenticated', audienceSegments: [] } });
    renderEditor({ loadPolicy, savePolicy: vi.fn(), loadSegments: vi.fn(async () => page([])) }, { target });
    await settle();
    expectSelectedAccess('Public');
    act(() =>
      provider.emit(
        JSON.stringify({
          v: 3,
          kind: 'entity.changed',
          entity: 'post:unrelated',
          scope: 'metadata',
          revision,
        }),
      ),
    );
    await flushAutosave();
    expect(loadPolicy).toHaveBeenCalledTimes(1);
    act(() =>
      provider.emit(
        JSON.stringify({ v: 3, kind: 'entity.changed', entity: 'post:post-1', scope: 'metadata', revision }),
      ),
    );
    await flushAutosave();
    await settle();
    expect(loadPolicy).toHaveBeenCalledTimes(2);
    expect(loadPolicy).toHaveBeenLastCalledWith(target);
    expectSelectedAccess('Signed-in users');
  });
  it('reloads the shown policy when a key-only peer hint arrives on the browser channel', async () => {
    const loadPolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['loadPolicy']>()
      .mockResolvedValueOnce({
        data: { fileId: 'file-1', audience: 'public', audienceSegments: [] },
      })
      .mockResolvedValueOnce({
        data: { fileId: 'file-1', audience: 'authenticated', audienceSegments: [] },
      });
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy,
      loadSegments: vi.fn(async () => page([])),
      savePolicy: vi.fn(),
    };

    renderEditor(adapter);
    await settle();

    const subscription = TestBroadcastChannel.channels.find(
      (channel) => channel.name === 'geul:editor-entity-changes:v1',
    );
    expect(subscription).toBeDefined();
    act(() => {
      subscription?.onmessage?.({
        data: { document: `file-policy:file-1:${defaultTarget.entityType}:post-1:block-1:file` },
      } as MessageEvent<unknown>);
    });
    await settle();

    expect(loadPolicy).toHaveBeenCalledTimes(2);
    expectSelectedAccess('Signed-in users');
  });

  it('blocks edits when a peer refresh shows that the exact selector now points at another file', async () => {
    const loadPolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['loadPolicy']>()
      .mockResolvedValueOnce({
        data: { fileId: 'file-1', audience: 'public', audienceSegments: [] },
      })
      .mockResolvedValueOnce({
        data: { fileId: 'file-2', audience: 'authenticated', audienceSegments: [] },
      });
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy,
      loadSegments: vi.fn(async () => page([])),
      savePolicy: vi.fn(),
    };

    renderEditor(adapter);
    await settle();
    const subscription = TestBroadcastChannel.channels.find(
      (channel) => channel.name === 'geul:editor-entity-changes:v1',
    );
    act(() => {
      subscription?.onmessage?.({
        data: { document: `file-policy:file-1:${defaultTarget.entityType}:post-1:block-1:file` },
      } as MessageEvent<unknown>);
    });
    await settle();

    expect(inputForLabel('Download access').disabled).toBe(true);
    expect(host?.textContent).toContain('Reload before continuing to edit.');
  });

  it('reloads the exact selector after an own-origin parent hint without replacing a pending policy edit', async () => {
    vi.useFakeTimers();
    const provider = policyProvider();
    policyRuntime.current = {
      entityType: 'post',
      entityId: 'post-1',
      provider: provider as unknown as HocuspocusProvider,
    };
    const saving = Promise.withResolvers<FileDownloadActionResult<FileDownloadPolicyModel>>();
    const loadPolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['loadPolicy']>()
      .mockResolvedValueOnce({ data: { fileId: 'file-1', audience: 'public', audienceSegments: [] } })
      .mockResolvedValueOnce({ data: { fileId: 'replacement-file', audience: 'disabled', audienceSegments: [] } });
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>().mockReturnValueOnce(saving.promise);
    renderEditor({ loadPolicy, savePolicy, loadSegments: vi.fn(async () => page([])) });
    await settle();
    await selectOption('Download access', 'Signed-in users');
    await flushAutosave();
    act(() =>
      provider.emit(
        JSON.stringify({
          v: 3,
          kind: 'entity.changed',
          entity: 'post:post-1',
          scope: 'metadata',
          origin: getEditorWriteOrigin(),
        }),
      ),
    );
    await flushAutosave();
    expect(loadPolicy).toHaveBeenCalledTimes(1);
    expectSelectedAccess('Signed-in users');
    await act(async () =>
      saving.resolve({ data: { fileId: 'file-1', audience: 'authenticated', audienceSegments: [] } }),
    );
    await settle();
    expect(loadPolicy).toHaveBeenCalledTimes(2);
    expect(loadPolicy).toHaveBeenLastCalledWith(defaultTarget);
    expect(inputForLabel('Download access').disabled).toBe(true);
  });

  it('titles the access field in block settings and describes the selected audience', async () => {
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async () => ({
        data: {
          fileId: 'file-1',
          audience: 'authenticated' as const,
          audienceSegments: [],
        },
      })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy: vi.fn(),
    };

    renderEditor(adapter, { presentation: 'block-settings' });
    await settle();

    expectSelectedAccess('Signed-in users');
    const description = 'Any signed-in user can download this file.';
    expect(inputForLabel('Download access')).toHaveAccessibleDescription(expect.stringContaining(description));
    // Next to name, description and caption, the field needs a visible title and meaning.
    expect(host?.querySelector('label')?.textContent).toBe('Download access');
    expect(host?.textContent).toContain(description);
  });

  it('renders a real loading state instead of a false disabled policy', async () => {
    const policyRead = Promise.withResolvers<Awaited<ReturnType<FileDownloadPolicyEditorAdapter['loadPolicy']>>>();
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(() => policyRead.promise),
      loadSegments: vi.fn(async () => page([])),
      savePolicy: vi.fn(),
    };

    renderEditor(adapter);

    expect(host?.textContent).toContain('Loading download access');
    expect(host?.textContent).not.toContain('No visitor can download this file');
    expect(host?.querySelector('input')).toBeNull();

    policyRead.resolve({
      data: {
        fileId: 'file-1',
        audience: 'public',
        audienceSegments: [],
      },
    });
    await settle();

    expectSelectedAccess('Public');
    expect(host?.textContent).not.toContain('Loading download access');
  });

  it('reports a policy load failure without rendering a false policy', async () => {
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async () => ({ errorCode: 'loadFailed' as const })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy: vi.fn(),
    };

    renderEditor(adapter);
    await settle();

    expect(host?.textContent).toContain('Download access could not be loaded.');
    expect(host?.querySelector('input[aria-label="Download access"]')).toBeNull();
  });

  it('keeps the loaded policy visible when Audience loading fails', async () => {
    const members = segment('audience-members', 'Members');
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async () => ({
        data: {
          fileId: 'file-1',
          audience: 'restricted' as const,
          audienceSegments: [members],
        },
      })),
      loadSegments: vi.fn(async () => ({ errorCode: 'loadFailed' as const })),
      savePolicy: vi.fn(),
    };

    renderEditor(adapter);
    await settle();

    expectSelectedAccess('Members');
    expect(host?.textContent).toContain('The policy loaded, but audiences could not be loaded.');
  });

  it('explains when no Audience segments are available', async () => {
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async () => ({
        data: {
          fileId: 'file-1',
          audience: 'restricted' as const,
          audienceSegments: [],
        },
      })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy: vi.fn(),
    };

    renderEditor(adapter);
    await settle();

    expect(host?.textContent).toContain('No Audience segments are available.');
  });

  it('auto-saves a changed audience and shows compact synchronization feedback', async () => {
    const savePolicy = vi.fn(async (_target, audience) => ({
      data: {
        fileId: 'file-1',
        audience,
        audienceSegments: [],
      },
    }));
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async () => ({
        data: {
          fileId: 'file-1',
          audience: 'public' as const,
          audienceSegments: [],
        },
      })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    };

    renderEditor(adapter);
    await settle();
    const synchronizationStatus = host?.querySelector('[data-file-download-policy-sync]');
    expect(synchronizationStatus?.textContent).toBe('');
    vi.useFakeTimers();
    await selectOption('Download access', 'Signed-in users');
    expect(synchronizationStatus?.textContent).toBe('Syncing...');
    await flushAutosave();
    await settle();

    expectSelectedAccess('Signed-in users');
    expect(host?.querySelector('[data-file-download-policy-sync]')).toBe(synchronizationStatus);
    expect(synchronizationStatus?.textContent).toBe('Synced');
    expect(host?.textContent).toContain('Synced');
    expect(host?.textContent).not.toContain('Save access');
  });

  it.each([
    { result: { errorCode: 'saveFailed' as const }, message: 'Download access could not be saved. Try again' },
    {
      result: { errorCode: 'staleTarget' as const },
      message: 'A newer version was saved while this editor was open. Reload before continuing to edit.',
    },
  ])('notifies a $result.errorCode write that finished after the editor closed', async ({ result, message }) => {
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async (target) => ({
        data: { fileId: target.expectedFileId, audience: 'public' as const, audienceSegments: [] },
      })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy: vi.fn(async () => result),
    };

    renderEditor(adapter);
    await settle();
    vi.useFakeTimers();
    await selectOption('Download access', 'No downloads');
    act(() => root?.unmount());
    root = null;
    await settle();

    expect(notifications.show).toHaveBeenCalledWith({
      autoClose: false,
      tone: 'danger',
      title: 'Download access',
      message,
    });
  });

  it('flushes the latest old-target value before switching targets without overwriting the new UI', async () => {
    const oldTargetSave = Promise.withResolvers<Awaited<ReturnType<FileDownloadPolicyEditorAdapter['savePolicy']>>>();
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>((target, audience) =>
      target.expectedFileId === 'file-1'
        ? oldTargetSave.promise
        : Promise.resolve({ data: { fileId: target.expectedFileId, audience, audienceSegments: [] } }),
    );
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async (target) => ({
        data: { fileId: target.expectedFileId, audience: 'disabled' as const, audienceSegments: [] },
      })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    };

    renderEditor(adapter);
    await settle();
    vi.useFakeTimers();
    await selectOption('Download access', 'Public');

    const nextTarget = { ...defaultTarget, expectedFileId: 'file-2' };
    renderEditor(adapter, { target: nextTarget });
    await settle();

    expect(savePolicy).toHaveBeenCalledTimes(1);
    expect(savePolicy).toHaveBeenCalledWith(defaultTarget, 'public', [], expect.any(Object), expect.any(String));
    expectSelectedAccess('No downloads');

    oldTargetSave.resolve({ data: { fileId: 'file-1', audience: 'public', audienceSegments: [] } });
    await settle();

    expectSelectedAccess('No downloads');
    expect(savePolicy).toHaveBeenCalledTimes(1);
  });

  it('notifies a detached target-switch CAS failure with reload-required wording', async () => {
    const savePolicy = vi.fn(async () => ({ errorCode: 'staleTarget' as const }));
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async (target) => ({
        data: { fileId: target.expectedFileId, audience: 'public' as const, audienceSegments: [] },
      })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    };

    renderEditor(adapter);
    await settle();
    vi.useFakeTimers();
    await selectOption('Download access', 'No downloads');
    renderEditor(adapter, { target: { ...defaultTarget, expectedFileId: 'file-2' } });
    await settle();

    expect(savePolicy).toHaveBeenCalledWith(defaultTarget, 'disabled', [], expect.any(Object), expect.any(String));
    expect(notifications.show).toHaveBeenCalledWith({
      autoClose: false,
      tone: 'danger',
      title: 'Download access',
      message: 'A newer version was saved while this editor was open. Reload before continuing to edit.',
    });
  });

  it('keeps a selected Audience valid when it is outside the first list page', async () => {
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async () => ({
        data: {
          fileId: 'file-1',
          audience: 'restricted' as const,
          audienceSegments: [segment('later-page-segment', 'Tour members')],
        },
      })),
      loadSegments: vi.fn(async () => page([segment('first-page-segment', 'Members')])),
      savePolicy: vi.fn(),
    };

    renderEditor(adapter);
    await settle();

    expect(host?.textContent).toContain('Tour members');
    expect(inputForLabel('Download access').disabled).toBe(false);
  });

  it('guards browser unload while a policy write is pending or active', async () => {
    const activeSave = Promise.withResolvers<Awaited<ReturnType<FileDownloadPolicyEditorAdapter['savePolicy']>>>();
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async (target) => ({
        data: {
          fileId: target.expectedFileId,
          audience: 'public' as const,
          audienceSegments: [],
        },
      })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy: vi.fn(() => activeSave.promise),
    };

    renderEditor(adapter);
    await settle();
    vi.useFakeTimers();
    await selectOption('Download access', 'No downloads');

    const pendingUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(pendingUnload);
    expect(pendingUnload.defaultPrevented).toBe(true);

    await flushAutosave();
    const activeUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(activeUnload);
    expect(activeUnload.defaultPrevented).toBe(true);

    activeSave.resolve({
      data: {
        entityType: defaultTarget.entityType,
        entityId: defaultTarget.entityId,
        blockId: defaultTarget.blockId,
        referencePath: defaultTarget.referencePath,
        fileId: defaultTarget.expectedFileId,
        audience: 'disabled',
        audienceSegments: [],
      },
    });
    await settle();

    const cleanUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanUnload);
    expect(cleanUnload.defaultPrevented).toBe(false);
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it('visibly announces later Audience loading in the production block-settings presentation', async () => {
    const laterPage = Promise.withResolvers<Awaited<ReturnType<FileDownloadPolicyEditorAdapter['loadSegments']>>>();
    const firstAudience = segment('segment-1', 'Audience 1');
    const loadSegments = vi.fn<FileDownloadPolicyEditorAdapter['loadSegments']>(({ page: pageNumber = 1 }) =>
      pageNumber === 1 ? Promise.resolve(page([firstAudience], 1, true)) : laterPage.promise,
    );
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async () => ({
        data: {
          fileId: 'file-1',
          audience: 'restricted' as const,
          audienceSegments: [firstAudience],
        },
      })),
      loadSegments,
      savePolicy: vi.fn(),
    };

    renderEditor(adapter, { presentation: 'block-settings' });
    await settle();
    vi.useFakeTimers();

    await searchOptions('Download access', 'Audience');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    const loadingStatus = [...(host?.querySelectorAll('[role="status"][aria-live="polite"]') ?? [])].find((status) =>
      status.textContent?.includes('Loading download access'),
    );
    expect(loadingStatus?.textContent).toContain('Loading download access');
    expect(loadSegments).toHaveBeenCalledTimes(3);

    laterPage.resolve(page([segment('segment-2', 'Audience 2')], 2, false));
    await settle();

    expect(host?.textContent).not.toContain('Loading download access');
    expect(document.body.textContent).toContain('Audience 2');
  });

  it('keeps an archived-Audience policy restricted and fail-closed without auto-saving', async () => {
    const savePolicy = vi.fn(async (target, audience) => ({
      data: {
        fileId: target.expectedFileId,
        audience,
        audienceSegments: [],
      },
    }));
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async () => ({
        data: {
          fileId: 'file-1',
          audience: 'restricted' as const,
          audienceSegments: [],
        },
      })),
      loadSegments: vi.fn(async () => page([segment('active-segment', 'Members')])),
      savePolicy,
    };

    vi.useFakeTimers();
    renderEditor(adapter);
    await settle();

    expectSelectedAccess('Audiences');
    await flushAutosave();
    await settle();

    expect(savePolicy).not.toHaveBeenCalled();
    expectSelectedAccess('Audiences');
    expect(host?.textContent).toContain('This restricted policy has no Audience.');
    expect(host?.textContent).not.toContain('Synced');
  });

  it('does not mutate an empty restricted policy under StrictMode', async () => {
    const savePolicy = vi.fn(async (target, audience) => ({
      data: {
        fileId: target.expectedFileId,
        audience,
        audienceSegments: [],
      },
    }));
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async () => ({
        data: {
          fileId: 'file-1',
          audience: 'restricted' as const,
          audienceSegments: [],
        },
      })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    };

    vi.useFakeTimers();
    renderEditor(adapter, { strict: true });
    await settle();
    await flushAutosave();
    await settle();

    expect(savePolicy).not.toHaveBeenCalled();
    expectSelectedAccess('Audiences');
    expect(host?.textContent).toContain('This restricted policy has no Audience.');
  });

  it('reports failures and rolls the production block-settings back to the last persisted policy', async () => {
    const members = segment('audience-members', 'Members');
    const savePolicy = vi.fn(async () => ({ errorCode: 'saveFailed' as const }));
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async () => ({
        data: {
          fileId: 'file-1',
          audience: 'public' as const,
          audienceSegments: [],
        },
      })),
      loadSegments: vi.fn(async () => ({
        data: {
          items: [members],
          page: 1,
          pageSize: 50,
          total: 1,
          totalPages: 1,
          hasMore: false,
        },
      })),
      savePolicy,
    };

    renderEditor(adapter, { presentation: 'block-settings' });
    await settle();

    vi.useFakeTimers();
    await selectOption('Download access', 'Members');
    await flushAutosave();
    await settle();

    expectSelectedAccess('Public');
    expect(host?.textContent).not.toContain('Members');
    const saveError = Array.from(host?.querySelectorAll('[role="alert"]') ?? []).find((candidate) =>
      candidate.textContent?.includes('Download access could not be saved'),
    );
    expect(saveError).toBeTruthy();
    expect(inputForLabel('Download access').getAttribute('aria-describedby')?.split(' ')).toContain(saveError?.id);
    expect(host?.textContent).not.toContain('Synced');
    expect(host?.querySelector('[data-file-download-policy-presentation="block-settings"]')).toBeTruthy();
    expect(host?.textContent).not.toContain('Save access');
  });
});
