// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emailLayoutLocaleValuesMap,
  hydrateEmailLayoutCanonicalRoom,
  type EmailLayoutUnit,
} from '@echovisionlab/geul-common/collaboration/email-layout';
import * as Y from 'yjs';
import { useEmailLayoutCollaboration } from './useSourceDocumentCollaboration';

const layoutId = '11111111-1111-4111-8111-111111111111';
const unit: EmailLayoutUnit = {
  handle: 'unit:22222222-2222-4222-8222-222222222222:text',
  kind: 'text',
  element: '',
  attribute: '',
  order: 0,
  sourceValue: 'Source value',
};
let mockDoc: Y.Doc;
let latestHook: ReturnType<typeof useEmailLayoutCollaboration> | null = null;
let root: Root | null = null;
let container: HTMLDivElement | null = null;

vi.mock('@/lib/hooks/useHocuspocusConnection', () => ({
  useHocuspocusConnection: () => ({
    provider: null,
    doc: mockDoc,
    isConnected: true,
    isSynced: true,
  }),
}));

function Harness({ locale }: { locale: string }) {
  latestHook = useEmailLayoutCollaboration(layoutId, locale);
  return null;
}

function renderHook(locale: string) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<Harness locale={locale} />));
}

async function flush() {
  await act(async () => Promise.resolve());
}

function hook() {
  expect(latestHook).not.toBeNull();
  return latestHook as ReturnType<typeof useEmailLayoutCollaboration>;
}

beforeEach(() => {
  mockDoc = hydrateEmailLayoutCanonicalRoom({
    sourceLocale: 'en',
    locale: 'ko',
    localeExists: true,
    contentHtml: '',
    units: [unit],
  });
  latestHook = null;
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  mockDoc.destroy();
});

describe('useEmailLayoutCollaboration', () => {
  it('edits sparse target values and restores source fallback through the canonical map', async () => {
    renderHook('ko');
    await flush();

    expect(hook().targetUnits[0]).toMatchObject({ value: 'Source value', localeValuePresent: false });
    act(() => hook().setTargetValue(unit.handle, ''));
    await flush();
    expect(emailLayoutLocaleValuesMap(mockDoc).get(unit.handle)).toBe('');
    expect(hook().targetUnits[0]).toMatchObject({ value: '', localeValuePresent: true });

    act(() => hook().useSourceFallback(unit.handle));
    await flush();
    expect(emailLayoutLocaleValuesMap(mockDoc).has(unit.handle)).toBe(false);
    expect(hook().targetUnits[0]).toMatchObject({ value: 'Source value', localeValuePresent: false });
  });

  it('does not expose target fields in the source raw-HTML room', async () => {
    mockDoc.destroy();
    mockDoc = hydrateEmailLayoutCanonicalRoom({
      sourceLocale: 'en',
      locale: 'en',
      localeExists: true,
      contentHtml: '<main>Source</main>',
      units: [unit],
    });
    renderHook('en');
    await flush();
    expect(hook().targetUnits).toEqual([]);
  });
});
