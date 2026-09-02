// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useCurrentPageRowSelection, type CurrentPageRowSelectionResult } from './selection';

interface Row {
  id: string;
  label: string;
}

let latestSelection: CurrentPageRowSelectionResult<Row> | null = null;
let container: HTMLDivElement | null = null;
let root: Root | null = null;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Harness({ rows }: { rows: Row[] }) {
  latestSelection = useCurrentPageRowSelection(
    rows,
    (row) => row.id,
    (row) => row.label,
  );
  return null;
}

function render(rows: Row[]) {
  if (!container) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }

  act(() => {
    root?.render(<Harness rows={rows} />);
  });
}

function getSelection() {
  expect(latestSelection).not.toBeNull();
  return latestSelection as CurrentPageRowSelectionResult<Row>;
}

beforeEach(() => {
  latestSelection = null;
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
});

describe('useCurrentPageRowSelection', () => {
  it('prunes selected keys that disappear from the current page rows', () => {
    render([
      { id: 'row-1', label: 'First' },
      { id: 'row-2', label: 'Second' },
      { id: 'row-3', label: 'Third' },
    ]);

    act(() => {
      getSelection().onSelectedRowKeysChange(['row-1', 'row-3']);
    });

    render([
      { id: 'row-1', label: 'First' },
      { id: 'row-2', label: 'Second' },
    ]);

    expect(getSelection().selectedRowKeys).toEqual(['row-1']);
    expect(getSelection().selectedOnPageRowKeys).toEqual(['row-1']);
    expect(getSelection().selectedOnPageCount).toBe(1);
    expect(getSelection().allOnPageSelected).toBe(false);
    expect(getSelection().someOnPageSelected).toBe(true);
  });

  it('tracks all-on-page selection and clears it explicitly', () => {
    render([
      { id: 'row-1', label: 'First' },
      { id: 'row-2', label: 'Second' },
    ]);

    act(() => {
      getSelection().onSelectedRowKeysChange(['row-1', 'row-2']);
    });

    expect(getSelection().selectedOnPageCount).toBe(2);
    expect(getSelection().allOnPageSelected).toBe(true);
    expect(getSelection().someOnPageSelected).toBe(false);

    act(() => {
      getSelection().clearSelection();
    });

    expect(getSelection().selectedRowKeys).toEqual([]);
    expect(getSelection().selectedOnPageCount).toBe(0);
    expect(getSelection().allOnPageSelected).toBe(false);
    expect(getSelection().someOnPageSelected).toBe(false);
  });
});
