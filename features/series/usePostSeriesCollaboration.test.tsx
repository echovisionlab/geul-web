// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hydratePostSeriesCanonicalRoom,
  postSeriesLocaleFieldsMap,
} from '@echovisionlab/geul-common/collaboration/post-series';
import * as Y from 'yjs';
import { usePostSeriesCollaboration } from './usePostSeriesCollaboration';

const seriesId = '11111111-1111-4111-8111-111111111111';
let mockDoc: Y.Doc;
let latestHook: ReturnType<typeof usePostSeriesCollaboration> | null = null;
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
  latestHook = usePostSeriesCollaboration(seriesId, locale);
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
  return latestHook as ReturnType<typeof usePostSeriesCollaboration>;
}

beforeEach(() => {
  mockDoc = hydratePostSeriesCanonicalRoom({
    sourceLocale: 'en',
    locale: 'ko',
    localeExists: true,
    source: { title: 'Source title', summary: 'Source summary' },
    requested: { title: '' },
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

describe('usePostSeriesCollaboration', () => {
  it('materializes source fallback and preserves explicit empty target fields', async () => {
    renderHook('ko');
    await flush();

    expect(hook().roomState).toEqual({
      sourceLocale: 'en',
      locale: 'ko',
      fields: { title: '', summary: 'Source summary' },
    });
    act(() => hook().setField('summary', ''));
    await flush();
    expect(postSeriesLocaleFieldsMap(mockDoc).get('summary')).toBe('');
    expect(hook().roomState?.fields.summary).toBe('');
  });

  it('writes source fields into the same canonical locale map', async () => {
    mockDoc.destroy();
    mockDoc = hydratePostSeriesCanonicalRoom({
      sourceLocale: 'en',
      locale: 'en',
      localeExists: true,
      source: { title: 'Source title' },
      requested: { title: 'Source title' },
    });
    renderHook('en');
    await flush();

    act(() => hook().setField('title', 'Updated'));
    await flush();
    expect(postSeriesLocaleFieldsMap(mockDoc).get('title')).toBe('Updated');
    expect(hook().roomState?.fields.title).toBe('Updated');
  });
});
