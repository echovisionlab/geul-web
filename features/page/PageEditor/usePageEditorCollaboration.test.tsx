// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { usePageEditorCollaboration } from './usePageEditorCollaboration';

let mockDoc: Y.Doc;
let latestHook: ReturnType<typeof usePageEditorCollaboration> | null = null;
let container: HTMLDivElement | null = null;
let root: Root | null = null;
const pageId = '11111111-1111-4111-8111-111111111111';
const { useBlockRoomConnection } = vi.hoisted(() => ({ useBlockRoomConnection: vi.fn() }));

vi.mock('@/lib/utils/client-logger', () => ({
  createClientLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/lib/collab/useBlockRoomConnection', async () => {
  const React = await import('react');

  return {
    useBlockRoomConnection: (...arguments_: unknown[]) => {
      useBlockRoomConnection(...arguments_);
      const [doc, setDoc] = React.useState<Y.Doc | null>(null);

      React.useEffect(() => {
        setDoc(mockDoc);
      }, []);

      return {
        provider: null,
        doc,
        bootstrap: null,
        isConnected: doc !== null,
        isSynced: doc !== null,
        isLoading: doc === null,
        error: null,
      };
    },
  };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  mockDoc = new Y.Doc();
  latestHook = null;
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

function TestHarness() {
  latestHook = usePageEditorCollaboration(pageId, 'ko');
  return null;
}

function renderHarness() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<TestHarness />);
  });
}

async function flushUpdates() {
  await act(async () => {
    await Promise.resolve();
  });
}

function getHook() {
  expect(latestHook).not.toBeNull();
  return latestHook as ReturnType<typeof usePageEditorCollaboration>;
}

describe('usePageEditorCollaboration', () => {
  it('connects the active locale Page document and does not create a domain-fact shadow map', async () => {
    renderHarness();
    await flushUpdates();

    expect(getHook().doc).toBe(mockDoc);
    expect(getHook().isConnected).toBe(true);
    expect(getHook().isSynced).toBe(true);
    expect(useBlockRoomConnection).toHaveBeenCalledWith('page', pageId, 'ko');
    expect(mockDoc.share.has('page-fields')).toBe(false);
  });
});
