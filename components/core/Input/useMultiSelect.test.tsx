// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMultiSelect } from './useMultiSelect';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type HookValue = ReturnType<typeof useMultiSelect<{ id: string; name: string }>>;

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let value: HookValue | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  value = null;
});

describe('useMultiSelect', () => {
  it('filters options and emits a trimmed create intent', () => {
    const onCreate = vi.fn();
    renderHook(onCreate);

    act(() => value?.setSearch('  New genre  '));
    expect(value?.filteredOptions).toEqual([]);
    expect(value?.canCreate).toBe(true);

    act(() => value?.handleValueSelect('$create'));
    expect(onCreate).toHaveBeenCalledWith('New genre');
  });
});

function renderHook(onCreate: (name: string) => void) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  function HookHarness() {
    value = useMultiSelect({
      selectedItems: [],
      options: [{ id: 'ambient', name: 'Ambient' }],
      onSelect: vi.fn(),
      onDeselect: vi.fn(),
      onCreate,
    });
    return null;
  }

  act(() => root?.render(<HookHarness />));
}
