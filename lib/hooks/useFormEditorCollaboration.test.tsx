// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { formRootTitleTarget, formStepTitleTarget } from '@echovisionlab/geul-proto/intra/form_locale_catalog.ts';
import { hydrateFormCanonicalRoom, type FormCollabFields } from '@echovisionlab/geul-common/collaboration/form';
import type { FormFields } from '@/lib/collab/form-fields';
import { useFormEditorCollaboration } from './useFormEditorCollaboration';

let mockDoc: Y.Doc;
let latestHook: ReturnType<typeof useFormEditorCollaboration> | null = null;
let container: HTMLDivElement | null = null;
let root: Root | null = null;
const formId = '11111111-1111-4111-8111-111111111111';
let documentName: string | null = null;

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
      React.useEffect(() => {
        queueMicrotask(() => onSynced?.(mockDoc));
      }, [onSynced]);

      return {
        provider: null,
        doc: mockDoc,
        isConnected: true,
        isSynced: true,
      };
    },
  };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
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
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
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
});
