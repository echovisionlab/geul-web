// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
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
      <MantineProvider env="test">
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
          onLoadMore={() => undefined}
          onViewModeChange={() => undefined}
          {...overrides}
        />
      </MantineProvider>,
    );
  });
}

describe('EditorFileLibraryPickerView', () => {
  it('does not narrow the result surface with a persistent detail inspector', () => {
    renderView();

    expect(host.querySelector('[data-file-library-details]')).toBeNull();
    expect(host.querySelector('[data-inspector-open]')).toBeNull();
  });

  it('confirms an eligible file on double click', () => {
    const onConfirmFiles = vi.fn();
    renderView([], { onConfirmFiles });

    act(() => {
      host
        .querySelector<HTMLElement>('[data-file-viewer-item="story-file-audio"]')
        ?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });

    expect(onConfirmFiles).toHaveBeenCalledWith([expect.objectContaining({ id: 'story-file-audio' })]);
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

  it('requests the next search page when the result sentinel approaches the viewport', () => {
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

    renderView([], { hasMore: true, onLoadMore });
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
    act(() => {
      callback([entry], intersectionObserver!);
    });

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
