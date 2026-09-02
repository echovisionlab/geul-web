// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hydrateMenuCanonicalRoom, menuLocaleLabelsMap } from '@echovisionlab/geul-common/collaboration/menu';
import * as Y from 'yjs';
import { useMenuCollaboration } from './useMenuCollaboration';

const menuId = '11111111-1111-4111-8111-111111111111';
let mockDoc: Y.Doc;
let latestHook: ReturnType<typeof useMenuCollaboration> | null = null;
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
  latestHook = useMenuCollaboration(menuId, locale);
  return null;
}

async function renderHook(locale: string) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<Harness locale={locale} />));
  await act(async () => Promise.resolve());
}

function hook() {
  expect(latestHook).not.toBeNull();
  return latestHook as ReturnType<typeof useMenuCollaboration>;
}

beforeEach(() => {
  mockDoc = hydrateMenuCanonicalRoom({
    sourceLocale: 'en',
    locale: 'ko',
    localeExists: true,
    name: 'Main',
    items: [{ id: 'posts', linkType: 'custom', url: '/posts' }],
    sourceLabels: { posts: 'Posts' },
    requestedLabels: {},
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

describe('useMenuCollaboration', () => {
  it('edits a sparse target label and restores source fallback', async () => {
    await renderHook('ko');
    expect(hook().roomState?.items[0]?.label).toBe('Posts');

    act(() => hook().setLabel('posts', ''));
    expect(menuLocaleLabelsMap(mockDoc).get('posts')).toBe('');
    expect(hook().roomState?.items[0]?.label).toBe('');

    act(() => hook().useSourceLabel('posts'));
    expect(menuLocaleLabelsMap(mockDoc).has('posts')).toBe(false);
    expect(hook().roomState?.items[0]?.label).toBe('Posts');
  });

  it('updates source name and structure through the same room', async () => {
    mockDoc.destroy();
    mockDoc = hydrateMenuCanonicalRoom({
      sourceLocale: 'en',
      locale: 'en',
      localeExists: true,
      name: 'Main',
      items: [{ id: 'posts', label: 'Posts', linkType: 'custom', url: '/posts' }],
      sourceLabels: { posts: 'Posts' },
      requestedLabels: { posts: 'Posts' },
    });
    await renderHook('en');

    act(() =>
      hook().replaceSource('Primary', [{ id: 'archive', label: 'Archive', linkType: 'custom', url: '/archive' }]),
    );
    expect(hook().roomState).toMatchObject({
      name: 'Primary',
      items: [{ id: 'archive', label: 'Archive', linkType: 'custom' }],
    });
  });
});
