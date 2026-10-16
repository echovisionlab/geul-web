// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from 'react-aria-components';
import { EditorFileLibraryPickerView, type EditorFileLibraryPickerViewProps } from './EditorFileLibraryPickerView';
import {
  editorFileLibraryBrowseRows,
  editorFileLibraryPickerStoryLabels,
  isEditorFileLibraryStoryRowDisabled,
} from './EditorFileLibraryPickerView.fixtures';

vi.mock('@/features/media/FilePreview', () => ({
  FilePreview: ({ file }: { file: { id: string } }) => <div data-file-preview={file.id} />,
}));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  class TestResizeObserver implements ResizeObserver {
    disconnect() {}
    observe() {}
    unobserve() {}
  }
  vi.stubGlobal('ResizeObserver', TestResizeObserver);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

function renderView(
  selectedFiles = editorFileLibraryBrowseRows.filter((row) => row.kind === 'file').slice(0, 1),
  overrides: Partial<EditorFileLibraryPickerViewProps> = {},
) {
  act(() => {
    root.render(
      <I18nProvider locale="en">
        <EditorFileLibraryPickerView
          labels={editorFileLibraryPickerStoryLabels}
          rows={editorFileLibraryBrowseRows}
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
          {...overrides}
        />
      </I18nProvider>,
    );
  });
}

describe('EditorFileLibraryPickerView', () => {
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
      const row = host.querySelector<HTMLElement>(
        viewMode === 'grid'
          ? '[data-file-viewer-item="story-file-image"]'
          : '[data-datatable-desktop-row="file:story-file-image"]',
      )!;
      expect(row.hasAttribute('aria-disabled')).toBe(false);
      expect(row).toHaveAccessibleDescription(editorFileLibraryPickerStoryLabels.selectionUnavailableDescription);
      act(() => {
        row.click();
        row.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
      });
      expect(onConfirmFiles).not.toHaveBeenCalled();
      expect(onSelectedFilesChange).not.toHaveBeenCalled();
      const previewCommand =
        viewMode === 'list'
          ? host.querySelector<HTMLButtonElement>(
              '[data-datatable-mobile-row="file:story-file-image"] [data-datatable-row-interaction-control]',
            )!
          : row;
      expect(previewCommand).toHaveAccessibleDescription(
        editorFileLibraryPickerStoryLabels.selectionUnavailableDescription,
      );
      act(() =>
        previewCommand.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
      );
      expect(document.body.querySelector('[role="dialog"] [data-file-preview="story-file-image"]')).not.toBeNull();
      expect(onConfirmFiles).not.toHaveBeenCalled();
      expect(onSelectedFilesChange).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])('preserves mobile native command semantics with allowMultiple=%s', (allowMultiple) => {
    const onActivateRow = vi.fn();
    const onConfirmFiles = vi.fn();
    const onSelectedFilesChange = vi.fn();
    renderView([], { viewMode: 'list', allowMultiple, onActivateRow, onConfirmFiles, onSelectedFilesChange });
    const folder = host.querySelector<HTMLElement>('[data-datatable-mobile-row="folder:story-folder-recordings"]')!;
    const folderTrigger = folder.querySelector<HTMLButtonElement>('[data-datatable-row-interaction-control]')!;
    expect(folder.getAttribute('role')).toBe('group');
    expect(document.getElementById(folderTrigger.getAttribute('aria-labelledby')!)?.textContent).toContain(
      'Recordings',
    );
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    act(() => folderTrigger.dispatchEvent(space));
    expect(space.defaultPrevented).toBe(true);
    expect(onActivateRow).not.toHaveBeenCalled();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => folderTrigger.dispatchEvent(enter));
    expect(enter.defaultPrevented).toBe(true);
    expect(onActivateRow).toHaveBeenCalledExactlyOnceWith(editorFileLibraryBrowseRows[0]);
    expect(onConfirmFiles).not.toHaveBeenCalled();
    const fileTrigger = host.querySelector<HTMLButtonElement>(
      '[data-datatable-mobile-row="file:story-file-audio"] [data-datatable-row-interaction-control]',
    )!;
    act(() => fileTrigger.focus());
    expect(document.activeElement).toBe(fileTrigger);
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
    const rows = Array.from(host.querySelectorAll('[data-datatable-desktop-row]'));
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.querySelector('svg'))).toBe(true);
    expect(rows[0].textContent).toContain('folder');
    expect(rows[0].textContent).not.toContain('—');
    expect(
      host.querySelector('[data-datatable-mobile-row="folder:story-folder-recordings"]')?.textContent,
    ).not.toContain('—');
    expect(rows[1].textContent).toContain('wav');
    expect(rows[1].textContent).not.toContain('audio/wav');
    expect(rows[2].textContent).toContain('png');
    expect(rows[2].textContent).not.toContain('image/png');
  });

  it('omits single-selection checkboxes in both responsive list layouts', () => {
    renderView([], { viewMode: 'list', allowMultiple: false });
    expect(host.querySelector('input[type="checkbox"]')).toBeNull();
    renderView([], { allowMultiple: false });
    expect(host.querySelector('[role="grid"]')?.getAttribute('aria-multiselectable')).toBe('false');
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
    const desktop = host.querySelector('[data-datatable-desktop-row]')?.closest('table');
    expect(desktop?.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
    act(() => desktop?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click());
    expect(onSelectedFilesChange).toHaveBeenCalledWith([editorFileLibraryBrowseRows[1], secondFile]);
    const selected = [editorFileLibraryBrowseRows[1], secondFile];
    if (selected[0].kind !== 'file') {
      throw new Error('Expected a file fixture');
    }
    renderView([selected[0], secondFile], { rows, viewMode: 'list', onConfirmFiles });
    const add = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === '추가');
    expect(add?.disabled).toBe(false);
    act(() => add?.click());
    expect(onConfirmFiles).toHaveBeenCalledWith(selected);
  });

  it.each(['grid', 'list'] as const)('confirms single selection immediately in %s view without Add', (viewMode) => {
    const onConfirmFiles = vi.fn();
    const onActivateRow = vi.fn();
    renderView([], { viewMode, allowMultiple: false, onConfirmFiles, onActivateRow });
    const row =
      viewMode === 'grid'
        ? host.querySelector<HTMLElement>('[data-file-viewer-item="story-file-audio"]')
        : host.querySelector<HTMLElement>('[data-datatable-desktop-row="file:story-file-audio"]');
    act(() => row?.click());
    expect(onConfirmFiles).toHaveBeenCalledWith([editorFileLibraryBrowseRows[1]]);
    expect(onActivateRow).not.toHaveBeenCalled();
    expect(Array.from(host.querySelectorAll('button')).some((button) => button.textContent === '추가')).toBe(false);
  });

  it.each(['grid', 'list'] as const)(
    'selects folders on click, opens them on double click and excludes them from Add in %s',
    (viewMode) => {
      const onActivateRow = vi.fn();
      const onConfirmFiles = vi.fn();
      const onSelectedFilesChange = vi.fn();
      const overrides = { viewMode, onActivateRow, onConfirmFiles, onSelectedFilesChange };
      const folderNode = () =>
        host.querySelector<HTMLElement>(
          viewMode === 'grid'
            ? '[data-file-viewer-item="story-folder-recordings"]'
            : '[data-datatable-desktop-row="folder:story-folder-recordings"]',
        );
      renderView([], overrides);
      act(() => folderNode()?.click());
      expect(onActivateRow).not.toHaveBeenCalled();
      expect(folderNode()?.hasAttribute('data-selected')).toBe(true);
      expect(onSelectedFilesChange).toHaveBeenLastCalledWith([]);
      const add = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === '추가');
      expect(add?.disabled).toBe(true);
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
    const folder = host.querySelector<HTMLElement>('[data-file-viewer-item="story-folder-recordings"]');
    act(() => folder?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
    expect(folder?.getAttribute('aria-selected')).toBe('true');
    expect(onActivateRow).not.toHaveBeenCalled();
    const viewport = Array.from(host.querySelectorAll<HTMLDivElement>('div')).find((node) =>
      node.style.getPropertyValue('--_selection-inset'),
    );
    act(() => viewport?.click());
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
    const folder = host.querySelector<HTMLElement>('[data-file-viewer-item="story-folder-recordings"]');
    act(() => folder?.dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true })));
    expect(folder?.getAttribute('aria-selected')).toBe('true');
    expect(onSelectedFilesChange).toHaveBeenLastCalledWith([file]);
    const add = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === '추가');
    act(() => add?.click());
    expect(onConfirmFiles).toHaveBeenCalledExactlyOnceWith([file]);
  });

  it('uses Finder-style highlighted grid selection without checkboxes', () => {
    const onSelectedFilesChange = vi.fn();
    const onActivateRow = vi.fn();
    renderView([], { onSelectedFilesChange, onActivateRow });
    expect(host.querySelector('input[type="checkbox"]')).toBeNull();
    act(() => host.querySelector<HTMLElement>('[data-file-viewer-item="story-file-audio"]')?.click());
    expect(onSelectedFilesChange).toHaveBeenCalledWith([editorFileLibraryBrowseRows[1]]);
    expect(onActivateRow).not.toHaveBeenCalled();
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
      host.querySelector(`[data-file-viewer-item="${id}"]`)?.dispatchEvent(event);
    };
    renderView([], overrides);
    act(() => tap(first.id));
    renderView([first], overrides);
    act(() => tap(last.id));
    expect(onSelectedFilesChange).toHaveBeenLastCalledWith([first, last]);
    renderView([first, last], overrides);
    act(() => tap(first.id));
    expect(onSelectedFilesChange).toHaveBeenLastCalledWith([last]);
    expect(host.querySelector('input[type="checkbox"]')).toBeNull();
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
    const rowNode = (id: string) =>
      host.querySelector<HTMLElement>(
        viewMode === 'grid' ? `[data-file-viewer-item="${id}"]` : `[data-datatable-desktop-row="file:${id}"]`,
      );
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
    const checkbox = (id: string) => host.querySelector<HTMLElement>(`[data-datatable-desktop-row="file:${id}"] input`);
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
      const viewport = Array.from(host.querySelectorAll<HTMLDivElement>('div')).find((node) =>
        node.style.getPropertyValue('--_selection-inset'),
      );
      if (!viewport) {
        throw new Error('Missing selection viewport');
      }
      viewport.setPointerCapture = vi.fn();
      viewport.hasPointerCapture = () => true;
      viewport.releasePointerCapture = vi.fn();
      vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 400, 300));
      const items = host.querySelectorAll<HTMLElement>(
        viewMode === 'grid' ? '[data-file-viewer-item]' : '[data-datatable-desktop-row]',
      );
      items.forEach((node, index) =>
        vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 20 + index * 30, 100, 25)),
      );
      act(() =>
        viewport.dispatchEvent(
          new TestPointerEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0, pointerType: 'touch' }),
        ),
      );
      expect(onSelectedFilesChange).not.toHaveBeenCalled();
      act(() => viewport.dispatchEvent(new TestPointerEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 })));
      act(() =>
        viewport.dispatchEvent(new TestPointerEvent('pointermove', { bubbles: true, clientX: 150, clientY: 160 })),
      );
      expect(onSelectedFilesChange).toHaveBeenLastCalledWith([first, last]);
      act(() =>
        viewport.dispatchEvent(new TestPointerEvent('pointerup', { bubbles: true, clientX: 150, clientY: 160 })),
      );
      act(() => viewport.click());
      expect(onSelectedFilesChange).toHaveBeenLastCalledWith([first, last]);
    },
  );

  it('does not narrow the result surface with a persistent detail inspector', () => {
    renderView();

    expect(host.querySelector('[data-file-library-details]')).toBeNull();
    expect(host.querySelector('[data-inspector-open]')).toBeNull();
  });

  it('previews an eligible file on double click without submitting a partial multi-selection', () => {
    const onConfirmFiles = vi.fn();
    renderView([], { onConfirmFiles });

    act(() => {
      host
        .querySelector<HTMLElement>('[data-file-viewer-item="story-file-audio"]')
        ?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    expect(onConfirmFiles).not.toHaveBeenCalled();
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('field-recording.wav');
  });

  it('opens Quick Look from the context menu and omits Add for an unavailable file', () => {
    renderView([]);

    const unavailableFile = host.querySelector<HTMLElement>('[data-file-viewer-item="story-file-image"]');
    act(() => {
      unavailableFile?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 24, clientY: 32 }));
    });

    const menuItems = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).map(
      (item) => item.textContent,
    );
    expect(menuItems).toContain('미리보기');
    expect(menuItems).not.toContain('추가');

    const previewItem = Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
      (item) => item.textContent === '미리보기',
    );
    act(() => previewItem?.click());

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.textContent).toContain('poster.png');
    expect(dialog?.textContent).toContain('image/png');
    expect(dialog?.textContent).toContain('2.3 MB');
    expect(dialog?.textContent).toContain('파일 / Library');
    expect(dialog?.querySelector('[data-file-preview="story-file-image"]')).not.toBeNull();
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
