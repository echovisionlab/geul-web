// @vitest-environment jsdom

import { act, render, screen, within, fireEvent } from '@/test/render';
import { PageLoader } from '@/features/site/PageLoader';
import { editorLibraryFileDisplayName } from '../lib/editor-library-file-selection';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorFileLibraryPickerView, type EditorFileLibraryPickerViewProps } from './EditorFileLibraryPickerView';
import {
  editorFileLibraryBrowseRows,
  editorFileLibraryPickerStoryLabels,
  isEditorFileLibraryStoryRowDisabled,
} from './EditorFileLibraryPickerView.fixtures';

vi.mock('@/lib/media/wavesurfer-player', () => ({
  mountWaveSurferPlayer: async (
    options: Parameters<typeof import('@/lib/media/wavesurfer-player').mountWaveSurferPlayer>[0],
  ) => {
    options.onStateChange?.({ currentTime: 0, duration: 100, isPlaying: false, isMuted: false, isReady: true });
    return { setTime: () => undefined, getDuration: () => 100, destroy: () => undefined };
  },
}));

const browseRows = editorFileLibraryBrowseRows.map((row) =>
  row.kind === 'file' && row.mimeType.startsWith('image/')
    ? { ...row, inlineUrl: '/storybook/media/video-poster.jpg' }
    : row,
);
let rendered: ReturnType<typeof render> | undefined;
let currentRows = editorFileLibraryBrowseRows;
beforeEach(() => {
  rendered = undefined;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function rowNode(id: string) {
  const item = currentRows.find((row) => row.id === id)!;
  const label = item.kind === 'folder' ? item.name : editorLibraryFileDisplayName(item);
  const peers = currentRows.filter(
    (row) => (row.kind === 'folder' ? row.name : editorLibraryFileDisplayName(row)) === label,
  );
  return screen.getAllByRole('row', { name: new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })[
    peers.indexOf(item)
  ]!;
}
function mobileRow(id: string) {
  const item = currentRows.find((row) => row.id === id)!;
  const label = item.kind === 'folder' ? item.name : editorLibraryFileDisplayName(item);
  return screen.getByRole('group', { name: new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
}
function mobileCommand(id: string) {
  return within(mobileRow(id)).getByRole('button');
}
function viewport() {
  return screen.getByRole('region', { name: /개 (결과|항목)/ });
}
function addButton() {
  return screen.queryByRole('button', { name: editorFileLibraryPickerStoryLabels.add });
}

function renderView(
  selectedFiles = editorFileLibraryBrowseRows.filter((row) => row.kind === 'file').slice(0, 1),
  overrides: Partial<EditorFileLibraryPickerViewProps> = {},
) {
  currentRows = overrides.rows ?? browseRows;
  const node = (
    <EditorFileLibraryPickerView
      labels={editorFileLibraryPickerStoryLabels}
      rows={browseRows}
      path={[{ name: '파일' }]}
      query="recording"
      searchScope="folder"
      mimeTypePrefix=""
      sort="name:asc"
      searching
      total={3}
      viewMode="grid"
      selectedFiles={selectedFiles}
      allowMultiple
      isRowDisabled={isEditorFileLibraryStoryRowDisabled}
      onQueryChange={() => undefined}
      onSearchScopeChange={() => undefined}
      onMimeTypePrefixChange={() => undefined}
      onSortChange={() => undefined}
      onOpenPath={() => undefined}
      onActivateRow={() => undefined}
      onSelectedFilesChange={() => undefined}
      onConfirmFiles={() => undefined}
      onReturnToParent={() => undefined}
      onLoadMore={async () => undefined}
      onViewModeChange={() => undefined}
      loadingSurface={<PageLoader placement="flow" />}
      {...overrides}
    />
  );
  if (rendered) {
    rendered.rerender(node);
  } else {
    rendered = render(node);
  }
  return rendered;
}

describe('EditorFileLibraryPickerView', () => {
  it('shows the common initial wait without rows or a false empty result', () => {
    renderView([], { loading: true });
    expect(screen.getByRole('status', { name: 'Loading...' })).toHaveTextContent('Loading...');
    expect(screen.queryByText(editorFileLibraryPickerStoryLabels.empty)).not.toBeInTheDocument();
    expect(screen.queryByRole('row')).not.toBeInTheDocument();
    expect(screen.queryByText(editorFileLibraryPickerStoryLabels.searchResultCount(3))).not.toBeInTheDocument();
  });

  it.each([
    ['grid', false],
    ['grid', true],
    ['list', false],
    ['list', true],
  ] as const)(
    'keeps an ineligible file preview available and rejects selection in %s with allowMultiple=%s',
    (viewMode, allowMultiple) => {
      const onConfirmFiles = vi.fn();
      const onSelectedFilesChange = vi.fn();
      renderView([], { viewMode, allowMultiple, onConfirmFiles, onSelectedFilesChange });
      const row = rowNode('story-file-image');
      expect(row.hasAttribute('aria-disabled')).toBe(false);
      expect(row).toHaveAccessibleDescription(editorFileLibraryPickerStoryLabels.selectionUnavailableDescription);
      act(() => {
        row.click();
        row.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
      });
      expect(onConfirmFiles).not.toHaveBeenCalled();
      expect(onSelectedFilesChange).not.toHaveBeenCalled();
      const previewCommand = viewMode === 'list' ? mobileCommand('story-file-image') : row;
      expect(previewCommand).toHaveAccessibleDescription(
        editorFileLibraryPickerStoryLabels.selectionUnavailableDescription,
      );
      act(() =>
        previewCommand.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
      );
      expect(within(screen.getByRole('dialog')).getByRole('img', { name: 'poster.png' })).not.toBeNull();
      expect(onConfirmFiles).not.toHaveBeenCalled();
      expect(onSelectedFilesChange).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])('preserves mobile native command semantics with allowMultiple=%s', (allowMultiple) => {
    const onActivateRow = vi.fn();
    const onConfirmFiles = vi.fn();
    const onSelectedFilesChange = vi.fn();
    renderView([], { viewMode: 'list', allowMultiple, onActivateRow, onConfirmFiles, onSelectedFilesChange });
    const folder = mobileRow('story-folder-recordings');
    const folderTrigger = within(folder).getByRole('button');
    expect(folder.getAttribute('role')).toBe('group');
    expect(folderTrigger).toHaveAccessibleName('Recordings');
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    act(() => folderTrigger.dispatchEvent(space));
    expect(space.defaultPrevented).toBe(true);
    expect(onActivateRow).not.toHaveBeenCalled();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => folderTrigger.dispatchEvent(enter));
    expect(enter.defaultPrevented).toBe(true);
    expect(onActivateRow).toHaveBeenCalledExactlyOnceWith(editorFileLibraryBrowseRows[0]);
    expect(onConfirmFiles).not.toHaveBeenCalled();
    const fileTrigger = mobileCommand('story-file-audio');
    act(() => fileTrigger.focus());
    expect(fileTrigger).toHaveFocus();
    const fileEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => fileTrigger.dispatchEvent(fileEnter));
    expect(fileEnter.defaultPrevented).toBe(true);
    if (allowMultiple) {
      expect(onSelectedFilesChange).toHaveBeenLastCalledWith([editorFileLibraryBrowseRows[1]]);
      expect(onConfirmFiles).not.toHaveBeenCalled();
    } else {
      expect(onConfirmFiles).toHaveBeenCalledExactlyOnceWith([editorFileLibraryBrowseRows[1]]);
    }
  });

  it('uses type icons for every list row and lowercase type labels', () => {
    renderView([], { viewMode: 'list', labels: { ...editorFileLibraryPickerStoryLabels, folderType: 'Folder' } });
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => /<svg[ >]/.test(row.innerHTML))).toBe(true);
    expect(rows[0].textContent).toContain('folder');
    expect(rows[0].textContent).not.toContain('—');
    expect(mobileRow('story-folder-recordings')?.textContent).not.toContain('—');
    expect(rows[1].textContent).toContain('wav');
    expect(rows[1].textContent).not.toContain('audio/wav');
    expect(rows[2].textContent).toContain('png');
    expect(rows[2].textContent).not.toContain('image/png');
  });

  it('omits single-selection checkboxes in both responsive list layouts', () => {
    renderView([], { viewMode: 'list', allowMultiple: false });
    expect(screen.queryByRole('checkbox')).toBeNull();
    renderView([], { allowMultiple: false });
    expect(screen.getByRole('grid')?.getAttribute('aria-multiselectable')).toBe('false');
  });

  it('selects only eligible files and adds the entire selection', () => {
    const onSelectedFilesChange = vi.fn();
    const onConfirmFiles = vi.fn();
    const secondFile = { ...editorFileLibraryBrowseRows[1], id: 'second-file' };
    if (secondFile.kind !== 'file') {
      throw new Error('Expected a file fixture');
    }
    const rows = [...editorFileLibraryBrowseRows, secondFile];
    renderView([], { rows, viewMode: 'list', onSelectedFilesChange });
    const desktop = screen.getByRole('table');
    expect(within(desktop).getAllByRole('checkbox')).toHaveLength(3);
    fireEvent.click(within(desktop).getByRole('checkbox', { name: editorFileLibraryPickerStoryLabels.selectAllRows }));
    expect(onSelectedFilesChange).toHaveBeenCalledWith([editorFileLibraryBrowseRows[1], secondFile]);
    const selected = [editorFileLibraryBrowseRows[1], secondFile];
    if (selected[0].kind !== 'file') {
      throw new Error('Expected a file fixture');
    }
    renderView([selected[0], secondFile], { rows, viewMode: 'list', onConfirmFiles });
    const add = addButton();
    expect(add).toBeEnabled();
    act(() => add?.click());
    expect(onConfirmFiles).toHaveBeenCalledWith(selected);
  });

  it.each(['grid', 'list'] as const)('confirms single selection immediately in %s view without Add', (viewMode) => {
    const onConfirmFiles = vi.fn();
    const onActivateRow = vi.fn();
    renderView([], { viewMode, allowMultiple: false, onConfirmFiles, onActivateRow });
    const row = rowNode('story-file-audio');
    act(() => row?.click());
    expect(onConfirmFiles).toHaveBeenCalledWith([editorFileLibraryBrowseRows[1]]);
    expect(onActivateRow).not.toHaveBeenCalled();
    expect(Boolean(addButton())).toBe(false);
  });

  it.each(['grid', 'list'] as const)(
    'selects folders on click, opens them on double click and excludes them from Add in %s',
    (viewMode) => {
      const onActivateRow = vi.fn();
      const onConfirmFiles = vi.fn();
      const onSelectedFilesChange = vi.fn();
      const overrides = { viewMode, onActivateRow, onConfirmFiles, onSelectedFilesChange };
      const folderNode = () => rowNode('story-folder-recordings');
      renderView([], overrides);
      act(() => folderNode()?.click());
      expect(onActivateRow).not.toHaveBeenCalled();
      expect(folderNode()?.hasAttribute('data-selected')).toBe(true);
      expect(onSelectedFilesChange).toHaveBeenLastCalledWith([]);
      const add = addButton();
      expect(add).toBeDisabled();
      act(() => folderNode()?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
      expect(onActivateRow).toHaveBeenCalledExactlyOnceWith(editorFileLibraryBrowseRows[0]);
      expect(onConfirmFiles).not.toHaveBeenCalled();
      renderView([], { ...overrides, path: [{ name: '파일' }, { id: 'recordings', name: 'Recordings' }] });
      expect(folderNode()?.hasAttribute('data-selected')).toBe(false);
    },
  );

  it('selects a folder with Space and opens it with Enter in a single-file picker', () => {
    const onActivateRow = vi.fn();
    const onConfirmFiles = vi.fn();
    renderView([], { allowMultiple: false, onActivateRow, onConfirmFiles });
    const folder = rowNode('story-folder-recordings');
    act(() => folder?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
    expect(folder?.getAttribute('aria-selected')).toBe('true');
    expect(onActivateRow).not.toHaveBeenCalled();
    const selectionViewport = viewport();
    act(() => selectionViewport.click());
    expect(folder?.getAttribute('aria-selected')).toBe('false');
    act(() => folder?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
    act(() => folder?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(onActivateRow).toHaveBeenCalledExactlyOnceWith(editorFileLibraryBrowseRows[0]);
    expect(onConfirmFiles).not.toHaveBeenCalled();
  });

  it('keeps a modifier-selected folder out of the confirmed file form values', () => {
    const file = editorFileLibraryBrowseRows[1];
    if (file.kind !== 'file') {
      throw new Error('Expected a file fixture');
    }
    const onConfirmFiles = vi.fn();
    const onSelectedFilesChange = vi.fn();
    renderView([file], { onConfirmFiles, onSelectedFilesChange });
    const folder = rowNode('story-folder-recordings');
    act(() => folder?.dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true })));
    expect(folder?.getAttribute('aria-selected')).toBe('true');
    expect(onSelectedFilesChange).toHaveBeenLastCalledWith([file]);
    const add = addButton();
    act(() => add?.click());
    expect(onConfirmFiles).toHaveBeenCalledExactlyOnceWith([file]);
  });

  it('toggles multiple grid files by touch without checkbox controls', () => {
    const first = editorFileLibraryBrowseRows[1];
    if (first.kind !== 'file') {
      throw new Error('Expected a file');
    }
    const last = { ...first, id: 'last-file' };
    const onSelectedFilesChange = vi.fn();
    const overrides = { rows: [first, last], onSelectedFilesChange };
    const tap = (id: string) => {
      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'pointerType', { value: 'touch' });
      rowNode(id)?.dispatchEvent(event);
    };
    renderView([], overrides);
    act(() => tap(first.id));
    renderView([first], overrides);
    act(() => tap(last.id));
    expect(onSelectedFilesChange).toHaveBeenLastCalledWith([first, last]);
    renderView([first, last], overrides);
    act(() => tap(first.id));
    expect(onSelectedFilesChange).toHaveBeenLastCalledWith([last]);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it.each(['grid', 'list'] as const)('supports plain, Ctrl/Cmd and Shift row selection in %s', (viewMode) => {
    const first = editorFileLibraryBrowseRows[1];
    if (first.kind !== 'file') {
      throw new Error('Expected a file');
    }
    const last = { ...first, id: 'last-file' };
    const rows = [...editorFileLibraryBrowseRows, last];
    const onSelectedFilesChange = vi.fn();
    const overrides = { rows, viewMode, onSelectedFilesChange };
    renderView([], overrides);
    act(() => rowNode(first.id)?.click());
    expect(onSelectedFilesChange).toHaveBeenLastCalledWith([first]);
    renderView([first], overrides);
    act(() => rowNode(last.id)?.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })));
    // The incompatible image between the endpoints must remain unselected.
    expect(onSelectedFilesChange).toHaveBeenLastCalledWith([first, last]);
    renderView([first, last], overrides);
    act(() => rowNode(first.id)?.dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true })));
    expect(onSelectedFilesChange).toHaveBeenLastCalledWith([last]);
    renderView([first, last], overrides);
    act(() => rowNode(last.id)?.click());
    expect(onSelectedFilesChange).toHaveBeenLastCalledWith([last]);
  });

  it('supports Shift selection from list checkboxes', () => {
    const first = editorFileLibraryBrowseRows[1];
    if (first.kind !== 'file') {
      throw new Error('Expected a file');
    }
    const middle = { ...first, id: 'middle-file', fileName: 'middle' };
    const last = { ...first, id: 'last-file', fileName: 'last' };
    const onSelectedFilesChange = vi.fn();
    const overrides = { rows: [first, middle, last], viewMode: 'list' as const, onSelectedFilesChange };
    const checkbox = (id: string) => within(rowNode(id)).getByRole('checkbox');
    renderView([], overrides);
    act(() => checkbox(first.id)?.click());
    renderView([first], overrides);
    act(() => checkbox(last.id)?.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })));
    expect(onSelectedFilesChange).toHaveBeenLastCalledWith([first, middle, last]);
  });

  it.each(['grid', 'list'] as const)(
    'supports marquee selection of eligible files in %s and preserves touch scrolling',
    (viewMode) => {
      class TestPointerEvent extends MouseEvent {
        pointerId: number;
        pointerType: string;
        constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string }) {
          super(type, init);
          this.pointerId = init.pointerId ?? 1;
          this.pointerType = init.pointerType ?? 'mouse';
        }
      }
      vi.stubGlobal('PointerEvent', TestPointerEvent);
      const first = editorFileLibraryBrowseRows[1];
      if (first.kind !== 'file') {
        throw new Error('Expected a file');
      }
      const last = { ...first, id: 'last-file' };
      const onSelectedFilesChange = vi.fn();
      renderView([], { viewMode, rows: [...editorFileLibraryBrowseRows, last], onSelectedFilesChange });
      // Locate the shared viewport by its inline inset contract.
      const selectionViewport = viewport();
      if (!selectionViewport) {
        throw new Error('Missing selection viewport');
      }
      selectionViewport.setPointerCapture = vi.fn();
      selectionViewport.hasPointerCapture = () => true;
      selectionViewport.releasePointerCapture = vi.fn();
      vi.spyOn(selectionViewport, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 400, 300));
      const items = currentRows.map((row) => rowNode(row.id));
      items.forEach((node, index) =>
        vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 20 + index * 30, 100, 25)),
      );
      act(() =>
        selectionViewport.dispatchEvent(
          new TestPointerEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0, pointerType: 'touch' }),
        ),
      );
      expect(onSelectedFilesChange).not.toHaveBeenCalled();
      act(() =>
        selectionViewport.dispatchEvent(new TestPointerEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 })),
      );
      act(() =>
        selectionViewport.dispatchEvent(
          new TestPointerEvent('pointermove', { bubbles: true, clientX: 150, clientY: 160 }),
        ),
      );
      expect(onSelectedFilesChange).toHaveBeenLastCalledWith([first, last]);
      act(() =>
        selectionViewport.dispatchEvent(
          new TestPointerEvent('pointerup', { bubbles: true, clientX: 150, clientY: 160 }),
        ),
      );
      act(() => selectionViewport.click());
      expect(onSelectedFilesChange).toHaveBeenLastCalledWith([first, last]);
    },
  );

  it('previews an eligible file on double click without submitting a partial multi-selection', () => {
    const onConfirmFiles = vi.fn();
    renderView([], { onConfirmFiles });

    act(() => {
      rowNode('story-file-audio')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    expect(onConfirmFiles).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')?.textContent).toContain('field-recording.wav');
  });

  it('opens Quick Look from the context menu and omits Add for an unavailable file', () => {
    renderView([]);

    const unavailableFile = rowNode('story-file-image');
    act(() => {
      unavailableFile?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 24, clientY: 32 }));
    });

    const menuItems = screen.getAllByRole('menuitem').map((item) => item.textContent);
    expect(menuItems).toContain('미리보기');
    expect(menuItems).not.toContain('추가');

    const previewItem = screen.getAllByRole('menuitem').find((item) => item.textContent === '미리보기');
    act(() => previewItem?.click());

    const dialog = screen.getByRole('dialog');
    expect(dialog?.textContent).toContain('poster.png');
    expect(dialog?.textContent).toContain('image/png');
    expect(dialog?.textContent).toContain('2.3 MB');
    expect(dialog?.textContent).toContain('파일 / Library');
    expect(within(dialog).getByRole('img', { name: 'poster.png' })).not.toBeNull();
  });

  it('requests the next search page when the result sentinel approaches the viewport', async () => {
    const onLoadMore = vi.fn();
    let intersectionCallback: IntersectionObserverCallback | undefined;
    let intersectionObserver: TestIntersectionObserver | undefined;
    let observedTarget: Element | undefined;
    class TestIntersectionObserver implements IntersectionObserver {
      readonly root: Element | Document | null;
      readonly rootMargin: string;
      readonly scrollMargin: string;
      readonly thresholds: readonly number[];
      disconnect() {}
      observe(target: Element) {
        observedTarget = target;
      }
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      unobserve(target: Element) {
        if (observedTarget === target) {
          observedTarget = undefined;
        }
      }
      constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
        intersectionCallback = callback;
        // eslint-disable-next-line @typescript-eslint/no-this-alias -- the test must return the created observer to its callback
        intersectionObserver = this;
        this.root = options.root ?? null;
        this.rootMargin = options.rootMargin ?? '0px';
        this.scrollMargin = options.scrollMargin ?? '0px';
        const threshold = options.threshold ?? 0;
        this.thresholds = Array.isArray(threshold) ? threshold : [threshold];
      }
    }
    vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);

    renderView([], { hasMore: true, nextPageKey: 'page-2', onLoadMore });
    const callback = intersectionCallback;
    const target = observedTarget;
    if (!callback || !intersectionObserver || !target) {
      throw new Error('Expected the file library sentinel to create an IntersectionObserver');
    }
    const rect: DOMRectReadOnly = {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      top: 0,
      right: 1,
      bottom: 1,
      left: 0,
      toJSON: () => ({ x: 0, y: 0, width: 1, height: 1, top: 0, right: 1, bottom: 1, left: 0 }),
    };
    const entry: IntersectionObserverEntry = {
      boundingClientRect: rect,
      intersectionRatio: 1,
      intersectionRect: rect,
      isIntersecting: true,
      rootBounds: null,
      target,
      time: 0,
    };
    await act(async () => {
      callback([entry], intersectionObserver!);
    });

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
