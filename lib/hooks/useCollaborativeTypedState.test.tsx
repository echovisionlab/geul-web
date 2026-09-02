// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { TypedMetaMap } from '@/lib/collab/TypedMetaMap';
import { useCollaborativeTypedState } from './useCollaborativeTypedState';

vi.mock('./useHocuspocusConnection', () => ({
  useHocuspocusConnection: () => ({
    provider: null,
    doc: null,
    isConnected: false,
    isSynced: false,
  }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TestSchema = z.object({
  title: z.string(),
  tags: z.array(z.string()),
});

type TestState = z.infer<typeof TestSchema>;
const TEST_DEFAULTS = TestSchema.parse({
  title: '',
  tags: [],
});

let latestState: TestState | null = null;
let latestSetTitle: ((value: string) => void) | null = null;

function TestHarness({ documentName, initialTitle }: { documentName: string; initialTitle: string }) {
  const result = useCollaborativeTypedState<typeof TestSchema>({
    documentName,
    createMap: () =>
      ({
        initAll() {},
        getAllWithDefaults(defaults: TestState) {
          return defaults;
        },
        observe() {
          return () => {};
        },
      }) as unknown as TypedMetaMap<typeof TestSchema>,
    defaults: TEST_DEFAULTS,
    initialState: {
      title: initialTitle,
    },
    normalizeInitialState: (state) => ({
      ...state,
      title: state.title.trim(),
    }),
  });

  latestState = result.state;
  latestSetTitle = (value: string) => result.setField('title', value);

  return null;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  latestState = null;
  latestSetTitle = null;
});

describe('useCollaborativeTypedState', () => {
  it('does not reset local state when normalize callbacks get a new identity on rerender', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <TestHarness documentName="work:11111111-1111-4111-8111-111111111111:ko" initialTitle="Initial title" />,
      );
    });

    expect(latestState?.title).toBe('Initial title');

    act(() => {
      latestSetTitle?.('Updated title');
    });

    expect(latestState?.title).toBe('Updated title');

    act(() => {
      root?.render(
        <TestHarness documentName="work:11111111-1111-4111-8111-111111111111:ko" initialTitle="Initial title" />,
      );
    });

    expect(latestState?.title).toBe('Updated title');
  });
});
