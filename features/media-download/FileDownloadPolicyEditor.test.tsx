// @vitest-environment jsdom

import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SegmentType } from '@echovisionlab/geul-proto/secure/audience_pb.ts';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { notifications } from '@mantine/notifications';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import type {
  AudienceSegmentSummary,
  FileDownloadActionResult,
  FileDownloadPolicyModel,
  FileDownloadPolicyTarget,
} from '@/lib/types/file-download-access';
import { FileDownloadPolicyEditor, type FileDownloadPolicyEditorAdapter } from './FileDownloadPolicyEditor';

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function renderEditor(
  adapter: FileDownloadPolicyEditorAdapter,
  options: {
    presentation?: 'standalone' | 'media-header';
    strict?: boolean;
    target?: FileDownloadPolicyTarget;
    exactEcho?: boolean;
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
          ) => echoPolicyTarget(await adapter.savePolicy(requestTarget, audience, audienceSegmentIds), requestTarget),
        };

  const editor = (
    <TestProviders>
      <FileDownloadPolicyEditor {...target} adapter={exactAdapter} presentation={options.presentation} />
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
    input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
  it('shows the current audience as a single compact media-header control', async () => {
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

    renderEditor(adapter, { presentation: 'media-header' });
    await settle();

    const headerControl = host?.querySelector('[data-file-download-policy-presentation="media-header"]');
    const audienceInput = host?.querySelector<HTMLInputElement>('input[aria-label="Download access"]');
    expect(headerControl).toBeTruthy();
    expect(headerControl?.closest('.mantine-Card-root')).toBeNull();
    expectSelectedAccess('Signed-in users');
    expect(audienceInput).toBeInstanceOf(HTMLInputElement);
    expect(audienceInput?.getAttribute('placeholder')).toBeNull();
    expect(host?.textContent).not.toContain('Control who can download the original file.');
    expect(host?.textContent).not.toContain('Any signed-in user can download this file.');
    expect(host?.textContent).not.toContain('Save access');
  });

  it.each([
    ['missing selector echo', {}],
    ['mismatched selector echo', { blockId: 'other-block' }],
  ])('rejects a %s even when the File identity matches', async (_label, selectorEcho) => {
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async () => ({
        data: {
          ...selectorEcho,
          fileId: defaultTarget.expectedFileId,
          audience: 'public' as const,
          audienceSegments: [],
        },
      })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy: vi.fn(),
    };

    renderEditor(adapter, { exactEcho: false });
    await settle();

    expect(host?.textContent).toContain('Reload before continuing to edit.');
    expect(host?.querySelector('input[aria-label="Download access"]')).toBeNull();
  });

  it('renders a real loading state instead of a false disabled policy', async () => {
    let resolvePolicy:
      ((value: Awaited<ReturnType<FileDownloadPolicyEditorAdapter['loadPolicy']>>) => void) | undefined;
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(
        () =>
          new Promise<Awaited<ReturnType<FileDownloadPolicyEditorAdapter['loadPolicy']>>>((resolve) => {
            resolvePolicy = resolve;
          }),
      ),
      loadSegments: vi.fn(async () => page([])),
      savePolicy: vi.fn(),
    };

    renderEditor(adapter);

    expect(host?.textContent).toContain('Loading download access');
    expect(host?.textContent).not.toContain('No visitor can download this file');
    expect(host?.querySelector('input')).toBeNull();

    resolvePolicy?.({
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
    vi.useFakeTimers();
    await selectOption('Download access', 'Signed-in users');
    await flushAutosave();
    await settle();

    expect(savePolicy).toHaveBeenCalledWith(defaultTarget, 'authenticated', []);
    expectSelectedAccess('Signed-in users');
    expect(host?.textContent).toContain('Synced');
    expect(host?.textContent).not.toContain('Save access');
  });

  it('serializes rapid changes so the latest audience wins', async () => {
    const latestSave = deferred<Awaited<ReturnType<FileDownloadPolicyEditorAdapter['savePolicy']>>>();
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>(() => latestSave.promise);
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async () => ({
        data: {
          fileId: 'file-1',
          audience: 'disabled' as const,
          audienceSegments: [],
        },
      })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    };

    renderEditor(adapter);
    await settle();
    vi.useFakeTimers();
    await selectOption('Download access', 'Public');
    await selectOption('Download access', 'Signed-in users');
    await selectOption('Download access', 'Disabled');

    expect(savePolicy).not.toHaveBeenCalled();
    await flushAutosave();
    expect(savePolicy).toHaveBeenCalledTimes(1);
    expect(savePolicy).toHaveBeenCalledWith(defaultTarget, 'disabled', []);
    latestSave.resolve({
      data: {
        fileId: 'file-1',
        audience: 'disabled',
        audienceSegments: [],
      },
    });
    await settle();

    expect(savePolicy).toHaveBeenCalledTimes(1);
    expectSelectedAccess('Disabled');
    expect(host?.textContent).toContain('Synced');
  });

  it('rolls a failed queued change back to the most recent confirmed save', async () => {
    const firstSave = deferred<Awaited<ReturnType<FileDownloadPolicyEditorAdapter['savePolicy']>>>();
    const savePolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['savePolicy']>()
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValueOnce({ errorCode: 'saveFailed' });
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async () => ({
        data: {
          fileId: 'file-1',
          audience: 'disabled' as const,
          audienceSegments: [],
        },
      })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    };

    renderEditor(adapter, { presentation: 'media-header' });
    await settle();
    vi.useFakeTimers();

    await selectOption('Download access', 'Public');
    await flushAutosave();
    await selectOption('Download access', 'Signed-in users');
    await flushAutosave();

    firstSave.resolve({
      data: {
        fileId: 'file-1',
        audience: 'public',
        audienceSegments: [],
      },
    });
    await settle();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await settle();

    expect(savePolicy).toHaveBeenNthCalledWith(1, defaultTarget, 'public', []);
    expect(savePolicy).toHaveBeenNthCalledWith(2, defaultTarget, 'authenticated', []);
    expectSelectedAccess('Public');
    expect(host?.textContent).toContain('Download access could not be saved');
    expect(host?.textContent).not.toContain('Synced');
  });

  it('flushes the latest old-target value before switching targets without overwriting the new UI', async () => {
    const oldTargetSave = deferred<Awaited<ReturnType<FileDownloadPolicyEditorAdapter['savePolicy']>>>();
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>((target, audience) =>
      target.expectedFileId === 'file-1'
        ? oldTargetSave.promise
        : Promise.resolve({
            data: {
              fileId: target.expectedFileId,
              audience,
              audienceSegments: [],
            },
          }),
    );
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async (target) => ({
        data: {
          fileId: target.expectedFileId,
          audience: 'disabled' as const,
          audienceSegments: [],
        },
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
    expect(savePolicy).toHaveBeenCalledWith(defaultTarget, 'public', []);
    expectSelectedAccess('Disabled');

    oldTargetSave.resolve({
      data: {
        fileId: 'file-1',
        audience: 'public',
        audienceSegments: [],
      },
    });
    await settle();

    expectSelectedAccess('Disabled');
    expect(savePolicy).toHaveBeenCalledTimes(1);
  });

  it('flushes one pending latest value when unmounted before the debounce', async () => {
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
          audience: 'disabled' as const,
          audienceSegments: [],
        },
      })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    };

    renderEditor(adapter);
    await settle();
    vi.useFakeTimers();
    await selectOption('Download access', 'Public');
    act(() => root?.unmount());
    root = null;

    expect(savePolicy).toHaveBeenCalledTimes(1);
    expect(savePolicy).toHaveBeenCalledWith(defaultTarget, 'public', []);
    await vi.runAllTimersAsync();
    await settle();
    expect(savePolicy).toHaveBeenCalledTimes(1);
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it('notifies a detached failed revoke and reloads the still-public policy on remount', async () => {
    const persistedAudience = 'public' as const;
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>(async () => ({
      errorCode: 'saveFailed' as const,
    }));
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async (target) => ({
        data: {
          fileId: target.expectedFileId,
          audience: persistedAudience,
          audienceSegments: [],
        },
      })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    };

    renderEditor(adapter);
    await settle();
    vi.useFakeTimers();
    await selectOption('Download access', 'Disabled');
    act(() => root?.unmount());
    root = null;
    await settle();

    expect(savePolicy).toHaveBeenCalledWith(defaultTarget, 'disabled', []);
    expect(notifications.show).toHaveBeenCalledWith({
      autoClose: false,
      color: 'red',
      title: 'Download access',
      message: 'Download access could not be saved. Try again',
    });

    renderEditor(adapter);
    await settle();
    expectSelectedAccess('Public');
    expect(host?.textContent).not.toContain('Synced');
  });

  it('notifies a detached target-switch CAS failure with reload-required wording', async () => {
    const savePolicy = vi.fn(async () => ({ errorCode: 'staleTarget' as const }));
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async (target) => ({
        data: {
          fileId: target.expectedFileId,
          audience: 'public' as const,
          audienceSegments: [],
        },
      })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    };

    renderEditor(adapter);
    await settle();
    vi.useFakeTimers();
    await selectOption('Download access', 'Disabled');
    renderEditor(adapter, { target: { ...defaultTarget, expectedFileId: 'file-2' } });
    await settle();

    expect(savePolicy).toHaveBeenCalledWith(defaultTarget, 'disabled', []);
    expect(notifications.show).toHaveBeenCalledWith({
      autoClose: false,
      color: 'red',
      title: 'Download access',
      message: 'A newer version was saved while this editor was open. Reload before continuing to edit.',
    });
  });

  it('guards browser unload while a policy write is pending or active', async () => {
    const activeSave = deferred<Awaited<ReturnType<FileDownloadPolicyEditorAdapter['savePolicy']>>>();
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
    await selectOption('Download access', 'Disabled');

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

  it('flushes the latest pending value after an active save settles during unmount', async () => {
    const activeSave = deferred<Awaited<ReturnType<FileDownloadPolicyEditorAdapter['savePolicy']>>>();
    const savePolicy = vi
      .fn<FileDownloadPolicyEditorAdapter['savePolicy']>()
      .mockImplementationOnce(() => activeSave.promise)
      .mockImplementation(async (target, audience) => ({
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
          audience: 'disabled' as const,
          audienceSegments: [],
        },
      })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    };

    renderEditor(adapter);
    await settle();
    vi.useFakeTimers();
    await selectOption('Download access', 'Public');
    await flushAutosave();
    expect(savePolicy).toHaveBeenCalledTimes(1);
    expect(savePolicy).toHaveBeenLastCalledWith(defaultTarget, 'public', []);

    await selectOption('Download access', 'Signed-in users');
    act(() => root?.unmount());
    root = null;
    expect(savePolicy).toHaveBeenCalledTimes(1);

    activeSave.resolve({
      data: {
        fileId: 'file-1',
        audience: 'public',
        audienceSegments: [],
      },
    });
    await settle();

    expect(savePolicy).toHaveBeenCalledTimes(2);
    expect(savePolicy).toHaveBeenLastCalledWith(defaultTarget, 'authenticated', []);
    await vi.runAllTimersAsync();
    expect(savePolicy).toHaveBeenCalledTimes(2);
  });

  it('drains old same-target writes before remount hydration and saves the new latest value last', async () => {
    const activeSave = deferred<Awaited<ReturnType<FileDownloadPolicyEditorAdapter['savePolicy']>>>();
    let persistedAudience: 'disabled' | 'public' | 'authenticated' | 'restricted' = 'disabled';
    let saveInvocation = 0;
    const order: string[] = [];
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>(async (target, audience) => {
      saveInvocation += 1;
      order.push(`save:${audience}`);
      if (saveInvocation === 1) {
        const result = await activeSave.promise;
        if (result.data) {
          persistedAudience = result.data.audience;
        }
        return result;
      }
      persistedAudience = audience;
      return {
        data: {
          fileId: target.expectedFileId,
          audience,
          audienceSegments: [],
        },
      };
    });
    const loadPolicy = vi.fn(async (target: FileDownloadPolicyTarget) => {
      order.push(`load:${persistedAudience}`);
      return {
        data: {
          fileId: target.expectedFileId,
          audience: persistedAudience,
          audienceSegments: [],
        },
      };
    });
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy,
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    };

    renderEditor(adapter);
    await settle();
    vi.useFakeTimers();
    await selectOption('Download access', 'Public');
    await flushAutosave();
    expect(savePolicy).toHaveBeenCalledTimes(1);

    await selectOption('Download access', 'Signed-in users');
    act(() => root?.unmount());
    root = null;
    renderEditor(adapter);
    await settle();

    expect(loadPolicy).toHaveBeenCalledTimes(1);
    expect(host?.textContent).toContain('Loading download access');

    activeSave.resolve({
      data: {
        fileId: 'file-1',
        audience: 'public',
        audienceSegments: [],
      },
    });
    await settle();
    await settle();

    expect(savePolicy).toHaveBeenCalledTimes(2);
    expect(savePolicy).toHaveBeenNthCalledWith(2, defaultTarget, 'authenticated', []);
    expect(loadPolicy).toHaveBeenCalledTimes(2);
    expectSelectedAccess('Signed-in users');

    await selectOption('Download access', 'Public');
    await flushAutosave();
    await settle();

    expect(savePolicy).toHaveBeenCalledTimes(3);
    expect(savePolicy).toHaveBeenLastCalledWith(defaultTarget, 'public', []);
    expect(order).toEqual(['load:disabled', 'save:public', 'save:authenticated', 'load:authenticated', 'save:public']);
  });

  it('does not let a pending old target block or overwrite a new target', async () => {
    const oldTargetSave = deferred<Awaited<ReturnType<FileDownloadPolicyEditorAdapter['savePolicy']>>>();
    const savePolicy = vi.fn<FileDownloadPolicyEditorAdapter['savePolicy']>((target, audience) =>
      target.expectedFileId === 'file-1'
        ? oldTargetSave.promise
        : Promise.resolve({
            data: {
              fileId: target.expectedFileId,
              audience,
              audienceSegments: [],
            },
          }),
    );
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async (target) => ({
        data: {
          fileId: target.expectedFileId,
          audience: 'disabled' as const,
          audienceSegments: [],
        },
      })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    };

    renderEditor(adapter);
    await settle();
    vi.useFakeTimers();
    await selectOption('Download access', 'Public');
    await flushAutosave();
    expect(savePolicy).toHaveBeenCalledTimes(1);

    const nextTarget = { ...defaultTarget, expectedFileId: 'file-2' };
    renderEditor(adapter, { target: nextTarget });
    await settle();
    await selectOption('Download access', 'Signed-in users');
    await flushAutosave();
    await settle();

    expect(savePolicy).toHaveBeenCalledTimes(2);
    expect(savePolicy).toHaveBeenLastCalledWith(nextTarget, 'authenticated', []);
    expectSelectedAccess('Signed-in users');

    oldTargetSave.resolve({
      data: {
        fileId: 'file-1',
        audience: 'public',
        audienceSegments: [],
      },
    });
    await settle();
    expectSelectedAccess('Signed-in users');
  });

  it('returns to Disabled when the last restricted Audience is removed', async () => {
    const members = segment('audience-members', 'Members');
    const savePolicy = vi.fn(async (target, audience, audienceSegmentIds) => ({
      data: {
        fileId: target.expectedFileId,
        audience,
        audienceSegments: audience === 'restricted' && audienceSegmentIds.includes(members.id) ? [members] : [],
      },
    }));
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async () => ({
        data: {
          fileId: 'file-1',
          audience: 'restricted' as const,
          audienceSegments: [members],
        },
      })),
      loadSegments: vi.fn(async () => page([members])),
      savePolicy,
    };

    renderEditor(adapter);
    await settle();
    vi.useFakeTimers();
    await selectOption('Download access', 'Members');
    await flushAutosave();
    await settle();

    expect(savePolicy).toHaveBeenCalledWith(defaultTarget, 'disabled', []);
    expectSelectedAccess('Disabled');
    expect(host?.textContent).not.toContain('This restricted policy has no Audience.');
    expect(host?.textContent).toContain('Synced');
  });

  it('visibly announces later Audience loading in the production media-header presentation', async () => {
    const laterPage = deferred<Awaited<ReturnType<FileDownloadPolicyEditorAdapter['loadSegments']>>>();
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

    renderEditor(adapter, { presentation: 'media-header' });
    await settle();
    vi.useFakeTimers();

    await searchOptions('Download access', 'Audience');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    const loadingStatus = host?.querySelector('[role="status"][aria-live="polite"]');
    expect(loadingStatus?.textContent).toContain('Loading download access');
    expect(loadSegments).toHaveBeenCalledTimes(3);

    laterPage.resolve(page([segment('segment-2', 'Audience 2')], 2, false));
    await settle();

    expect(host?.textContent).not.toContain('Loading download access');
    expect(document.body.textContent).toContain('Audience 2');
  });

  it('searches and exposes Audiences beyond page 2 without closing the dropdown', async () => {
    const audiences = Array.from({ length: 125 }, (_, index) =>
      segment(`segment-${index + 1}`, `Audience ${index + 1}`),
    );
    const loadSegments = vi.fn(async ({ page: pageNumber = 1, pageSize = 50, search = '' }) => {
      const matchingAudiences = search ? audiences.filter((audience) => audience.name.includes(search)) : audiences;
      const start = (pageNumber - 1) * pageSize;
      return {
        data: {
          items: matchingAudiences.slice(start, start + pageSize),
          page: pageNumber,
          pageSize,
          total: matchingAudiences.length,
          totalPages: Math.max(1, Math.ceil(matchingAudiences.length / pageSize)),
          hasMore: start + pageSize < matchingAudiences.length,
        },
      };
    });
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async () => ({
        data: {
          fileId: 'file-1',
          audience: 'restricted' as const,
          audienceSegments: [audiences[0]],
        },
      })),
      loadSegments,
      savePolicy: vi.fn(),
    };

    vi.useFakeTimers();
    renderEditor(adapter);
    await settle();

    await act(async () => {
      inputForLabel('Download access').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await searchOptions('Download access', 'Audience');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    await settle();

    expect(loadSegments).toHaveBeenNthCalledWith(1, { page: 1, pageSize: 50 });
    expect(loadSegments).toHaveBeenNthCalledWith(2, { page: 1, pageSize: 50, search: 'Audience' });
    expect(loadSegments).toHaveBeenNthCalledWith(3, { page: 2, pageSize: 50, search: 'Audience' });
    expect(loadSegments).toHaveBeenNthCalledWith(4, { page: 3, pageSize: 50, search: 'Audience' });
    expect(loadSegments).toHaveBeenCalledTimes(4);
    expect(document.body.textContent).toContain('Audience 125');

    await searchOptions('Download access', '');
    await searchOptions('Download access', 'Audience');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    await settle();

    expect(loadSegments).toHaveBeenCalledTimes(4);
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
    expect(host?.textContent).not.toContain('unavailable');
    expect(inputForLabel('Download access').disabled).toBe(false);
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
    expect(savePolicy).not.toHaveBeenCalled();
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

  it('does not normalize a stale empty restricted result after switching targets', async () => {
    const oldTargetLoad = deferred<Awaited<ReturnType<FileDownloadPolicyEditorAdapter['loadPolicy']>>>();
    const savePolicy = vi.fn();
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn((target) =>
        target.expectedFileId === 'file-1'
          ? oldTargetLoad.promise
          : Promise.resolve({
              data: {
                fileId: target.expectedFileId,
                audience: 'public' as const,
                audienceSegments: [],
              },
            }),
      ),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    };

    vi.useFakeTimers();
    renderEditor(adapter);
    await settle();
    const nextTarget = { ...defaultTarget, expectedFileId: 'file-2' };
    renderEditor(adapter, { target: nextTarget });
    await settle();

    oldTargetLoad.resolve({
      data: {
        fileId: 'file-1',
        audience: 'restricted',
        audienceSegments: [],
      },
    });
    await settle();
    await vi.runAllTimersAsync();

    expectSelectedAccess('Public');
    expect(savePolicy).not.toHaveBeenCalled();
  });

  it('reports failures and rolls the production media-header back to the last persisted policy', async () => {
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

    renderEditor(adapter, { presentation: 'media-header' });
    await settle();

    vi.useFakeTimers();
    await selectOption('Download access', 'Members');
    await flushAutosave();
    await settle();

    expect(savePolicy).toHaveBeenCalledWith(defaultTarget, 'restricted', ['audience-members']);
    expectSelectedAccess('Public');
    expect(host?.textContent).not.toContain('Members');
    const saveError = Array.from(host?.querySelectorAll('[role="alert"]') ?? []).find((candidate) =>
      candidate.textContent?.includes('Download access could not be saved'),
    );
    expect(saveError).toBeTruthy();
    expect(host?.textContent).not.toContain('Synced');
    expect(host?.querySelector('[data-file-download-policy-presentation="media-header"]')).toBeTruthy();
    expect(host?.textContent).not.toContain('Save access');
  });

  it('does not let a failed disable masquerade as persisted in the production media-header', async () => {
    const savePolicy = vi.fn(async () => ({ errorCode: 'saveFailed' as const }));
    const adapter: FileDownloadPolicyEditorAdapter = {
      loadPolicy: vi.fn(async () => ({
        data: {
          fileId: 'file-1',
          audience: 'authenticated' as const,
          audienceSegments: [],
        },
      })),
      loadSegments: vi.fn(async () => page([])),
      savePolicy,
    };

    renderEditor(adapter, { presentation: 'media-header' });
    await settle();
    vi.useFakeTimers();

    await selectOption('Download access', 'Disabled');
    await flushAutosave();
    await settle();

    expect(savePolicy).toHaveBeenCalledWith(defaultTarget, 'disabled', []);
    expectSelectedAccess('Signed-in users');
    expect(host?.textContent).not.toContain('Synced');
    expect(host?.textContent).toContain('Download access could not be saved');
  });
});
