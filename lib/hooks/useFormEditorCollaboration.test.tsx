// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { flushEditorSaves } from '@/lib/editor/editor-save-registry';
import { clearEditorSaveRecovery, persistEditorSaveRecoveryEntry } from '@/lib/editor/editor-save-recovery';
import {
  formRootTitleTarget,
  formStepDescriptionTarget,
  formStepTitleTarget,
} from '@echovisionlab/geul-proto/intra/form_locale_catalog.ts';
import { hydrateFormCanonicalRoom, type FormCollabFields } from '@echovisionlab/geul-common/collaboration/form';
import type { FormFields } from '@/lib/collab/form-fields';
import { useFormEditorCollaboration } from './useFormEditorCollaboration';

let mockDoc: Y.Doc;
let latestHook: ReturnType<typeof useFormEditorCollaboration> | null = null;
let container: HTMLDivElement | null = null;
let root: Root | null = null;
const formId = '11111111-1111-4111-8111-111111111111';
let documentName: string | null = null;
let mockIsSynced = true;

function createProviderMock() {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  return {
    configuration: { name: '' },
    hasUnsyncedChanges: false,
    forceSync: vi.fn(),
    sendStateless: vi.fn((_payload: string) => undefined),
    on: vi.fn((event: string, listener: (event: unknown) => void) => {
      const registered = listeners.get(event) ?? new Set();
      registered.add(listener);
      listeners.set(event, registered);
    }),
    off: vi.fn((event: string, listener: (event: unknown) => void) => {
      listeners.get(event)?.delete(listener);
    }),
    emit(event: string, payload: unknown) {
      for (const listener of listeners.get(event) ?? []) {
        listener(payload);
      }
    },
    listeners,
  };
}

let mockProvider = createProviderMock();

const sourceFields: FormCollabFields = {
  title: 'Server form',
  schema: {
    id: 'schema-1',
    steps: [{ id: 'step-1', title: 'Server step', fields: [] }],
  },
};

vi.mock('@/lib/utils/client-logger', () => ({
  createClientLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('./useHocuspocusConnection', async () => {
  const React = await import('react');

  return {
    useHocuspocusConnection: ({
      documentName: nextDocumentName,
      onSynced,
    }: {
      documentName: string | null;
      onSynced?: (doc: Y.Doc) => void;
    }) => {
      documentName = nextDocumentName;
      mockProvider.configuration.name = nextDocumentName ?? '';
      React.useEffect(() => {
        queueMicrotask(() => onSynced?.(mockDoc));
      }, [onSynced]);

      return {
        provider: mockProvider,
        doc: mockDoc,
        isConnected: true,
        isSynced: mockIsSynced,
      };
    },
  };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  clearEditorSaveRecovery(`form:${formId}:en`);
  mockDoc = hydrateFormCanonicalRoom({
    sourceLocale: 'en',
    locale: 'en',
    source: sourceFields,
    requested: sourceFields,
    requestedExists: true,
    presentLocaleValues: [formRootTitleTarget(), formStepTitleTarget('step-1')],
  });
  latestHook = null;
  documentName = null;
  mockIsSynced = true;
  mockProvider = createProviderMock();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
  mockDoc.destroy();
});

function TestHarness({ locale, initialFields }: { locale: string; initialFields?: Partial<FormFields> }) {
  latestHook = useFormEditorCollaboration(formId, locale, initialFields);
  return null;
}

function renderHarness(locale: string, initialFields?: Partial<FormFields>) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<TestHarness locale={locale} initialFields={initialFields} />);
  });
}

async function flushUpdates() {
  await act(async () => {
    await Promise.resolve();
  });
}

function getHook() {
  expect(latestHook).not.toBeNull();
  return latestHook as ReturnType<typeof useFormEditorCollaboration>;
}

describe('useFormEditorCollaboration', () => {
  it('uses the canonical synced room instead of writing initial fields into it', async () => {
    renderHarness('en', { title: 'Local fallback' });
    await flushUpdates();

    expect(getHook().fields.title).toBe('Server form');
    expect(mockDoc.getMap('form-fields').get('title')).toBe('Server form');

    act(() => {
      getHook().setField('title', 'Updated form');
    });
    await flushUpdates();

    expect(getHook().fields.title).toBe('Updated form');
    expect(documentName).toBe(`form:${formId}:en`);
  });

  it('does not initialize an absent canonical field from the local fallback', async () => {
    mockDoc.destroy();
    mockDoc = hydrateFormCanonicalRoom({
      sourceLocale: 'en',
      locale: 'en',
      source: { schema: sourceFields.schema },
      requested: { schema: sourceFields.schema },
      requestedExists: true,
      presentLocaleValues: [formStepTitleTarget('step-1')],
    });

    renderHarness('en', { title: 'Local fallback' });
    await flushUpdates();

    expect(getHook().fields.title).toBe('');
    expect(mockDoc.getMap('form-fields').get('title')).toBeUndefined();
  });

  it('records explicit target-locale field presence before writing the field', async () => {
    mockDoc.destroy();
    mockDoc = hydrateFormCanonicalRoom({
      sourceLocale: 'en',
      locale: 'ko',
      source: sourceFields,
      requested: {
        schema: { id: 'schema-1', steps: [{ id: 'step-1', fields: [] }] },
      },
      requestedExists: true,
      presentLocaleValues: [],
    });

    renderHarness('ko', { title: 'Local fallback' });
    await flushUpdates();

    expect(getHook().fields.title).toBe('Server form');

    act(() => {
      getHook().setField('title', '');
    });
    await flushUpdates();

    const target = formRootTitleTarget();
    const expectedPresenceKey =
      target.owner.case === 'blockHandle' ? `${target.owner.value}\u0000${target.fieldHandle}` : null;
    expect(expectedPresenceKey).not.toBeNull();
    expect(Array.from(mockDoc.getMap('form-locale-presence').keys())).toContain(expectedPresenceKey);
    expect(mockDoc.getMap('form-fields').get('title')).toBe('');
  });

  it('does not accept schema edits before the canonical room is synced', async () => {
    mockIsSynced = false;
    renderHarness('en');
    await flushUpdates();
    const before = mockDoc.getMap('form-fields').get('schema');
    const next = {
      id: 'schema-1',
      steps: [{ id: 'step-1', title: 'Not accepted', fields: [] }],
    };

    act(() => getHook().setField('schema', next));
    await flushUpdates();

    expect(mockDoc.getMap('form-fields').get('schema')).toBe(before);
    expect(getHook().fields.schema).toEqual(sourceFields.schema);
    expect(mockProvider.sendStateless).not.toHaveBeenCalled();
    expect(await flushEditorSaves(`form:${formId}`)).toBe(true);
  });

  it('resumes only the keyed schema orphan after the canonical room syncs', async () => {
    vi.useFakeTimers();
    mockIsSynced = false;
    const roomName = `form:${formId}:en`;
    const next = {
      id: 'schema-1',
      steps: [{ id: 'step-1', title: 'Recovered schema', fields: [] }],
    };
    persistEditorSaveRecoveryEntry(roomName, 'orphan-schema-queue', {
      document: `form:${formId}`,
      updatedAt: Date.now(),
      recoveryKey: 'form-schema',
      patch: {
        requestId: 'form-schema:recovered',
        documentName: roomName,
        previousSchema: sourceFields.schema,
        nextSchema: next,
        localRevision: 1,
      },
    });

    renderHarness('en');
    await flushUpdates();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(mockProvider.sendStateless).not.toHaveBeenCalled();

    mockIsSynced = true;
    act(() => {
      root?.render(<TestHarness locale="en" />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(mockProvider.sendStateless).toHaveBeenCalledOnce();
    const message = JSON.parse(mockProvider.sendStateless.mock.calls[0]![0] as string);
    expect(message).toMatchObject({ kind: 'form.schema.patch', nextSchema: next });

    act(() => {
      mockDoc.getMap('form-fields').set('schema', JSON.stringify(next));
      mockProvider.emit('stateless', {
        payload: JSON.stringify({
          kind: 'form.schema.patch.ack',
          protocolVersion: 1,
          requestId: message.requestId,
          documentName: roomName,
          ok: true,
          canonicalSchema: next,
        }),
      });
    });
    await flushUpdates();
    vi.useRealTimers();
  });

  it('keeps a queued schema intent and sends it through the rebuilt canonical provider', async () => {
    vi.useFakeTimers();
    renderHarness('en');
    await flushUpdates();

    const localNext = {
      id: 'schema-1',
      steps: [{ id: 'step-1', title: 'Local schema intent', fields: [] }],
    };
    act(() => getHook().setField('schema', localNext));
    const oldDoc = mockDoc;
    const oldProvider = mockProvider;

    const peerCanonicalSchema = {
      id: 'schema-1',
      steps: [{ id: 'step-1', title: 'Server step', description: 'Peer edit', fields: [] }],
    };
    mockDoc = hydrateFormCanonicalRoom({
      sourceLocale: 'en',
      locale: 'en',
      source: { ...sourceFields, schema: peerCanonicalSchema },
      requested: { ...sourceFields, schema: peerCanonicalSchema },
      requestedExists: true,
      presentLocaleValues: [formRootTitleTarget(), formStepTitleTarget('step-1'), formStepDescriptionTarget('step-1')],
    });
    mockProvider = createProviderMock();
    act(() => {
      root?.render(<TestHarness locale="en" />);
    });
    await flushUpdates();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(oldProvider.sendStateless).not.toHaveBeenCalled();
    expect(mockProvider.configuration.name).toBe(`form:${formId}:en`);
    expect(mockProvider.sendStateless).toHaveBeenCalledOnce();
    const message = JSON.parse(mockProvider.sendStateless.mock.calls[0]![0] as string);
    const expectedCanonical = {
      id: 'schema-1',
      steps: [{ id: 'step-1', title: 'Local schema intent', description: 'Peer edit', fields: [] }],
    };
    expect(message).toMatchObject({
      kind: 'form.schema.patch',
      documentName: `form:${formId}:en`,
      previousSchema: peerCanonicalSchema,
      nextSchema: expectedCanonical,
    });
    expect(mockDoc.getMap('form-fields').get('schema')).toBe(JSON.stringify(peerCanonicalSchema));

    act(() => {
      mockDoc.getMap('form-fields').set('schema', JSON.stringify(expectedCanonical));
      mockProvider.emit('stateless', {
        payload: JSON.stringify({
          kind: 'form.schema.patch.ack',
          protocolVersion: 1,
          requestId: message.requestId,
          documentName: `form:${formId}:en`,
          ok: true,
          canonicalSchema: expectedCanonical,
        }),
      });
    });
    await flushUpdates();

    expect(getHook().fields.schema).toEqual(expectedCanonical);
    oldDoc.destroy();
    vi.useRealTimers();
  });

  it('retries an in-flight schema intent only after the replacement provider syncs', async () => {
    vi.useFakeTimers();
    renderHarness('en');
    await flushUpdates();

    const localNext = {
      id: 'schema-1',
      steps: [{ id: 'step-1', title: 'Local schema intent', fields: [] }],
    };
    act(() => getHook().setField('schema', localNext));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    const oldProvider = mockProvider;
    const oldDoc = mockDoc;
    expect(oldProvider.sendStateless).toHaveBeenCalledOnce();
    act(() => {
      oldProvider.emit('stateless', {
        payload: JSON.stringify({ kind: 'reload_required', reason: 'reload_required' }),
      });
    });
    await flushUpdates();
    expect(oldProvider.listeners.get('stateless')).toHaveLength(0);

    const peerCanonicalSchema = {
      id: 'schema-1',
      steps: [{ id: 'step-1', title: 'Server step', description: 'Peer edit', fields: [] }],
    };
    mockDoc = hydrateFormCanonicalRoom({
      sourceLocale: 'en',
      locale: 'en',
      source: { ...sourceFields, schema: peerCanonicalSchema },
      requested: { ...sourceFields, schema: peerCanonicalSchema },
      requestedExists: true,
      presentLocaleValues: [formRootTitleTarget(), formStepTitleTarget('step-1'), formStepDescriptionTarget('step-1')],
    });
    mockProvider = createProviderMock();
    mockIsSynced = false;
    act(() => {
      root?.render(<TestHarness locale="en" />);
    });
    await flushUpdates();
    expect(mockProvider.sendStateless).not.toHaveBeenCalled();

    mockIsSynced = true;
    act(() => {
      root?.render(<TestHarness locale="en" />);
    });
    await flushUpdates();

    expect(mockProvider.configuration.name).toBe(`form:${formId}:en`);
    expect(mockProvider.sendStateless).toHaveBeenCalledOnce();
    const message = JSON.parse(mockProvider.sendStateless.mock.calls[0]![0] as string);
    const expectedCanonical = {
      id: 'schema-1',
      steps: [{ id: 'step-1', title: 'Local schema intent', description: 'Peer edit', fields: [] }],
    };
    expect(message).toMatchObject({
      kind: 'form.schema.patch',
      documentName: `form:${formId}:en`,
      previousSchema: peerCanonicalSchema,
      nextSchema: expectedCanonical,
    });
    expect(mockDoc.getMap('form-fields').get('schema')).toBe(JSON.stringify(peerCanonicalSchema));

    act(() => {
      mockDoc.getMap('form-fields').set('schema', JSON.stringify(expectedCanonical));
      mockProvider.emit('stateless', {
        payload: JSON.stringify({
          kind: 'form.schema.patch.ack',
          protocolVersion: 1,
          requestId: message.requestId,
          documentName: `form:${formId}:en`,
          ok: true,
          canonicalSchema: expectedCanonical,
        }),
      });
    });
    await flushUpdates();

    expect(getHook().fields.schema).toEqual(expectedCanonical);
    oldDoc.destroy();
    vi.useRealTimers();
  });

  it('submits FormSchema through ACK and flushes the registry without a local Y.Map overwrite', async () => {
    renderHarness('en');
    await flushUpdates();
    const previous = sourceFields.schema;
    const next = {
      id: 'schema-1',
      steps: [{ id: 'step-1', title: 'Saved step', fields: [] }],
    };

    act(() => getHook().setField('schema', next));
    expect(mockDoc.getMap('form-fields').get('schema')).toBe(JSON.stringify(previous));
    expect(getHook().fields.schema).toEqual(next);

    let flushResult: boolean | undefined;
    let flushing!: Promise<boolean>;
    act(() => {
      flushing = flushEditorSaves(`form:${formId}`);
    });
    await flushUpdates();
    expect(mockProvider.sendStateless).toHaveBeenCalledOnce();
    const message = JSON.parse(mockProvider.sendStateless.mock.calls[0]![0] as string);
    expect(message).toMatchObject({
      kind: 'form.schema.patch',
      documentName,
      previousSchema: previous,
      nextSchema: next,
    });
    expect(mockDoc.getMap('form-fields').get('schema')).toBe(JSON.stringify(previous));

    act(() => {
      mockDoc.getMap('form-fields').set('schema', JSON.stringify(next));
      mockProvider.emit('stateless', {
        payload: JSON.stringify({
          kind: 'form.schema.patch.ack',
          protocolVersion: 1,
          requestId: message.requestId,
          documentName,
          ok: true,
          canonicalSchema: next,
        }),
      });
    });
    await act(async () => {
      flushResult = await flushing;
    });

    expect(flushResult).toBe(true);
    expect(mockDoc.getMap('form-fields').get('schema')).toBe(JSON.stringify(next));
    await flushUpdates();
    expect(getHook().fields.schema).toEqual(next);
  });

  it('keeps failed schema intent registered for navigation retry', async () => {
    renderHarness('en');
    await flushUpdates();
    const next = {
      id: 'schema-1',
      steps: [{ id: 'step-1', title: 'Retained local draft', fields: [] }],
    };
    act(() => getHook().setField('schema', next));
    let flushResult: boolean | undefined;
    let flushing!: Promise<boolean>;
    act(() => {
      flushing = flushEditorSaves(`form:${formId}`);
    });
    await flushUpdates();
    const message = JSON.parse(mockProvider.sendStateless.mock.calls[0]![0] as string);
    act(() => {
      mockProvider.emit('stateless', {
        payload: JSON.stringify({
          kind: 'form.schema.patch.ack',
          protocolVersion: 1,
          requestId: message.requestId,
          documentName,
          ok: false,
          error: 'target_revision_changed',
        }),
      });
    });
    await act(async () => {
      flushResult = await flushing;
    });

    expect(flushResult).toBe(false);
    expect(getHook().fields.schema).toEqual(next);
    expect(mockDoc.getMap('form-fields').get('schema')).toBe(JSON.stringify(sourceFields.schema));
  });

  it('rebases a queued local schema edit over the previous canonical ACK', async () => {
    renderHarness('en');
    await flushUpdates();
    const firstNext = {
      id: 'schema-1',
      steps: [{ id: 'step-1', title: 'First local edit', fields: [] }],
    };
    act(() => getHook().setField('schema', firstNext));

    let flushResult: boolean | undefined;
    let flushing!: Promise<boolean>;
    act(() => {
      flushing = flushEditorSaves(`form:${formId}`);
    });
    await flushUpdates();
    const firstMessage = JSON.parse(mockProvider.sendStateless.mock.calls[0]![0] as string);

    const secondNext = structuredClone(getHook().fields.schema);
    secondNext.steps[0]!.description = 'Second local edit';
    act(() => getHook().setField('schema', secondNext));
    await flushUpdates();

    const firstCanonical: FormFields['schema'] = {
      id: 'schema-1',
      steps: [{ id: 'step-1', title: 'First local edit', showTitle: true, fields: [] }],
    };
    act(() => {
      mockDoc.getMap('form-fields').set('schema', JSON.stringify(firstCanonical));
      mockProvider.emit('stateless', {
        payload: JSON.stringify({
          kind: 'form.schema.patch.ack',
          protocolVersion: 1,
          requestId: firstMessage.requestId,
          documentName,
          ok: true,
          canonicalSchema: firstCanonical,
        }),
      });
    });
    await flushUpdates();
    await flushUpdates();

    expect(mockProvider.sendStateless).toHaveBeenCalledTimes(2);
    const secondMessage = JSON.parse(mockProvider.sendStateless.mock.calls[1]![0] as string);
    const expectedSecondCanonical = structuredClone(firstCanonical);
    expectedSecondCanonical.steps[0]!.description = 'Second local edit';
    expect(secondMessage).toMatchObject({
      previousSchema: firstCanonical,
      nextSchema: expectedSecondCanonical,
    });

    act(() => {
      mockDoc.getMap('form-fields').set('schema', JSON.stringify(expectedSecondCanonical));
      mockProvider.emit('stateless', {
        payload: JSON.stringify({
          kind: 'form.schema.patch.ack',
          protocolVersion: 1,
          requestId: secondMessage.requestId,
          documentName,
          ok: true,
          canonicalSchema: expectedSecondCanonical,
        }),
      });
    });
    await act(async () => {
      flushResult = await flushing;
    });

    expect(flushResult).toBe(true);
    expect(getHook().fields.schema).toEqual(expectedSecondCanonical);
  });
});
