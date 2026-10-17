// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { FileDerivativeType, FileUsageDomain } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { I18nProvider } from 'react-aria-components';
import { FileManagerView, type FileManagerViewLabels, type FileManagerViewProps } from './FileManagerView';
import type { FileManagerFileView, FileManagerItemView, FileManagerUsageItemView } from './model';

vi.mock('next-intl', () => ({ useTranslations: () => () => 'Loading files' }));
vi.mock('@/lib/contexts/ManifestContext', () => ({
  useSiteSettings: () => ({ settings: { loader_urls: ['https://assets.example/site-loader.gif'] } }),
}));

type FileManagerRow = FileManagerItemView;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

class TestResizeObserver implements ResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

globalThis.ResizeObserver = TestResizeObserver;

const labels: FileManagerViewLabels = {
  title: 'Files',
  description: 'Site file library',
  root: 'Files',
  back: 'Back',
  search: 'Search',
  allTypes: 'All types',
  images: 'Images',
  audio: 'Audio',
  video: 'Video',
  documents: 'Documents',
  folderType: 'Folder',
  sortName: 'Name',
  sortNewest: 'Newest',
  sortOldest: 'Oldest',
  sortSize: 'Largest',
  sortSmallest: 'Smallest',
  sortLabel: 'Sort',
  upload: 'Upload',
  newFolder: 'New folder',
  open: 'Open',
  preview: 'Preview',
  move: 'Move',
  moveHere: 'Move here',
  chooseDestination: 'Open the destination folder',
  delete: 'Delete',
  rename: 'Rename',
  download: 'Download',
  close: 'Close',
  cancel: 'Cancel',
  gridView: 'Grid view',
  listView: 'List view',
  viewMode: 'View',
  loadMore: 'Load more',
  pagination: {
    load: 'Load more',
    loading: 'Loading',
    end: 'End of results',
    retry: 'Try again',
    failed: 'Load failed',
  },
  name: 'Name',
  type: 'Type',
  size: 'Size',
  location: 'Location',
  uploadedBy: 'Uploaded by',
  uploadedAt: 'Date',
  usages: 'Used in',
  usageStatus: 'Usage',
  inUse: 'In use',
  notInUse: 'Not in use',
  usageDomains: {
    [FileUsageDomain.POST]: 'Post',
    [FileUsageDomain.SITE_SETTINGS]: 'Site Settings',
    [FileUsageDomain.TRACK]: 'Track',
  },
  usageSlots: {
    logo_full_light: 'Full logo · light',
    logo_full_dark: 'Full logo · dark',
    logo_symbol_light: 'Symbol · light',
    logo_symbol_dark: 'Symbol · dark',
    logo_email_light: 'Email logo · light',
    logo_email_dark: 'Email logo · dark',
    favicon: 'Site Favicon',
    loader: 'Site Loader',
    site_og_background: 'Home OG Background',
    privacy_og_background: 'Privacy OG Background',
    terms_og_background: 'Terms OG Background',
  },
  generatedOutputs: 'Generated outputs',
  generatedOutputTypes: {
    [FileDerivativeType.THUMBNAIL]: 'Thumbnail',
    [FileDerivativeType.OPTIMIZED_MESH]: 'Optimized mesh',
  },
  processingStatuses: {
    [MediaProcessingStatus.PROCESSING]: 'Processing',
    [MediaProcessingStatus.READY]: 'Ready',
    [MediaProcessingStatus.FAILED]: 'Failed',
  },
  adminOnly: 'Only admins can use this action.',
  actions: 'Actions',
  empty: 'No files',
  folderNotFound: 'This folder no longer exists.',
  returnToRoot: 'Return to Files',
  unknownMember: 'System',
  deletedMember: 'Deleted member',
  selectAll: 'Select all items',
  selectItem: (name) => `Select ${name}`,
  sortBy: (name) => `Sort by ${name}`,
  selectedCount: (count) => `${count} items selected`,
  itemCount: (count) => `${count} items`,
  searchResultCount: (count) => `${count} results found`,
  uploadProgress: (percentage) => `Uploading ${percentage}%`,
};

const rows: FileManagerRow[] = [
  {
    kind: 'folder',
    id: 'folder-1',
    name: '2026',
    createdAt: '2026-08-05T00:00:00Z',
    updatedAt: '2026-08-05T00:00:00Z',
  },
  {
    kind: 'file',
    id: 'file-1',
    fileName: 'cover',
    extension: 'jpg',
    mimeType: 'image/jpeg',
    fileSize: 2400,
    createdAt: '2026-08-05T00:00:00Z',
    updatedAt: '2026-08-05T00:00:00Z',
    usageCount: 11,
  },
];

let host: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = null;
  root = null;
});

function renderView(
  role: 'author' | 'admin',
  onSelectedItemIdsChange = vi.fn(),
  onViewModeChange = vi.fn(),
  viewMode: 'grid' | 'list' = 'grid',
  selectedItemIds: string[] = [],
  detailFile?: FileManagerFileView,
  detailUsages?: FileManagerUsageItemView[],
  overrides: Partial<FileManagerViewProps> = {},
) {
  act(() => {
    root?.render(
      <I18nProvider locale="en">
        <FileManagerView
          labels={labels}
          role={role}
          items={rows}
          path={[{ name: 'Files' }]}
          total={2}
          query=""
          mimeTypePrefix=""
          sort="name:asc"
          viewMode={viewMode}
          selectedItemIds={selectedItemIds}
          detailFile={detailFile}
          detailUsages={detailUsages}
          onQueryChange={vi.fn()}
          onMimeTypePrefixChange={vi.fn()}
          onSortChange={vi.fn()}
          onViewModeChange={onViewModeChange}
          onSelectedItemIdsChange={onSelectedItemIdsChange}
          onOpenPath={vi.fn()}
          onReturnToRoot={vi.fn()}
          onOpenFolder={vi.fn()}
          onOpenFile={vi.fn()}
          onCloseFile={vi.fn()}
          onUploadRequested={vi.fn()}
          onCreateFolder={vi.fn()}
          onRenameFolder={vi.fn()}
          onMoveFolder={vi.fn()}
          onDeleteFolder={vi.fn()}
          onRenameFile={vi.fn()}
          onMoveSelectedFiles={vi.fn()}
          onDeleteSelectedFiles={vi.fn()}
          onConfirmMoveHere={vi.fn()}
          onCancelMove={vi.fn()}
          onLoadMoreDetailUsages={vi.fn()}
          onLoadMoreItems={vi.fn()}
          {...overrides}
        />
      </I18nProvider>,
    );
  });
}

describe('FileManagerView', () => {
  it('keeps mobile list commands named and preserves modifier selection, Space and Enter on the native trigger', () => {
    const selected = vi.fn();
    const openFile = vi.fn();
    renderView('admin', selected, vi.fn(), 'list', ['folder-1'], undefined, undefined, { onOpenFile: openFile });
    const row = host!.querySelector<HTMLElement>('[data-datatable-mobile-row="file-1"]')!;
    const trigger = row.querySelector<HTMLButtonElement>('[data-datatable-row-interaction-control]')!;
    const rowName = document.getElementById(row.getAttribute('aria-labelledby')!)!;
    expect(row.getAttribute('role')).toBe('group');
    expect(trigger.getAttribute('aria-labelledby')).toBe(rowName.id);
    expect(rowName.textContent).toBe('cover.jpg');
    expect(trigger.contains(row.querySelector('input'))).toBe(false);
    act(() => trigger.focus());
    expect(document.activeElement).toBe(trigger);
    act(() => trigger.dispatchEvent(new MouseEvent('click', { ctrlKey: true, bubbles: true })));
    expect(selected).toHaveBeenLastCalledWith(['folder-1', 'file-1']);
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    act(() => trigger.dispatchEvent(space));
    expect(space.defaultPrevented).toBe(true);
    expect(selected).toHaveBeenLastCalledWith(['folder-1', 'file-1']);
    expect(openFile).not.toHaveBeenCalled();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => trigger.dispatchEvent(enter));
    expect(enter.defaultPrevented).toBe(true);
    expect(openFile).toHaveBeenCalledExactlyOnceWith(rows[1]);
    act(() => row.querySelector<HTMLInputElement>('input')!.click());
    expect(openFile).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard focus traversal, selection and activation as separate commands', () => {
    const selected = vi.fn();
    const openFile = vi.fn();
    renderView('admin', selected, vi.fn(), 'grid', ['folder-1'], undefined, undefined, { onOpenFile: openFile });
    const folder = host?.querySelector<HTMLElement>('[data-file-viewer-item="folder-1"]');
    const file = host?.querySelector<HTMLElement>('[data-file-viewer-item="file-1"]');
    expect(host?.querySelector('[data-file-viewer-grid]')?.getAttribute('role')).toBe('grid');
    expect(file?.getAttribute('role')).toBe('row');
    expect(file?.querySelector('[role="gridcell"] button')).not.toBeNull();
    act(() => folder?.focus());
    act(() => folder?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(document.activeElement).toBe(file);
    act(() => file?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
    expect(selected).toHaveBeenLastCalledWith(['folder-1', 'file-1']);
    expect(openFile).not.toHaveBeenCalled();
    act(() => file?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(openFile).toHaveBeenCalledWith(rows[1]);
    act(() => file?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
    expect(document.activeElement).toBe(folder);
  });

  it('names the file workspace, exposes asynchronous failure and keeps the upload progress name stable', () => {
    renderView('author', vi.fn(), vi.fn(), 'grid', [], undefined, undefined, {
      error: 'Upload failed',
      uploadPercentage: 42,
      mutationLoading: true,
    });
    const workspace = host?.querySelector('[data-file-manager-view]');
    expect(workspace?.getAttribute('role')).toBe('region');
    expect(workspace?.getAttribute('aria-label')).toBe('Files');
    expect(workspace?.getAttribute('aria-busy')).toBe('true');
    expect(host?.querySelector('[role="alert"]')?.textContent).toBe('Upload failed');
    expect(host?.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toBe('Upload');
    expect(host?.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('42');
    expect(host?.textContent).toContain('Uploading 42%');
  });

  it('separates move command names from the destination description', () => {
    renderView('admin', vi.fn(), vi.fn(), 'grid', [], undefined, undefined, {
      movePendingLabel: 'Move selected files',
    });
    const group = host?.querySelector('[data-file-move-mode]');
    const descriptionId = group?.getAttribute('aria-describedby');
    expect(group?.getAttribute('role')).toBe('group');
    expect(group?.getAttribute('aria-label')).toBe('Move');
    const description = descriptionId ? document.getElementById(descriptionId) : null;
    expect(description?.getAttribute('role')).toBe('status');
    expect(description?.textContent).toBe('Open the destination folder · Files');
    expect([...group!.querySelectorAll('button')].map((button) => button.textContent)).toEqual(['Cancel', 'Move here']);
  });

  it('contains the configured GIF in the 320px file-list loading surface without a visible generic message', () => {
    renderView('author', vi.fn(), vi.fn(), 'grid', [], undefined, undefined, { loading: true });
    const status = host?.querySelector<HTMLElement>('[role="status"]');
    const image = status?.querySelector<HTMLImageElement>('img');
    expect(status?.getAttribute('aria-label')).toBe('Loading files');
    expect(image?.getAttribute('alt')).toBe('Loading files');
    expect(image?.getAttribute('src')).toBe('https://assets.example/site-loader.gif');
    expect(status?.style.minHeight).toBe('320px');
    expect(status?.style.height).toBe('320px');
    expect(status?.parentElement?.style.position).toBe('relative');
    expect(status?.parentElement?.style.minHeight).toBe('320px');
    expect(status?.textContent).toBe('');
  });

  it('renders site-wide paths and keeps the search total independent of selection', () => {
    renderView('author', vi.fn(), vi.fn(), 'list', ['file-1'], undefined, undefined, {
      searching: true,
      query: 'cover',
      total: 12,
      items: [
        {
          ...rows[1],
          folderPath: [
            { id: 'library', name: 'Library' },
            { id: 'covers', name: 'Covers' },
          ],
        } as FileManagerItemView,
      ],
    });

    expect(document.body.textContent).toContain('Files / Library / Covers');
    expect(document.body.textContent).toContain('12 results found');
    expect(document.body.textContent).not.toContain('1 items selected');
    expect(document.querySelector('button[aria-label="Grid view"]')).toBeNull();
  });

  it('keeps Author actions read-only except upload', () => {
    renderView('author');

    expect(document.querySelector('button[aria-label="Upload"]')?.hasAttribute('disabled')).toBe(false);
    expect(document.querySelector('button[aria-label="New folder"]')?.hasAttribute('disabled')).toBe(true);
    expect(document.querySelector('button[aria-label="Move"]')?.hasAttribute('disabled')).toBe(true);
    expect(document.querySelector('button[aria-label="Delete"]')?.hasAttribute('disabled')).toBe(true);
    expect(document.querySelector('[data-file-viewer-grid]')).not.toBeNull();
    expect(document.querySelector('table')).toBeNull();
    expect(document.body.textContent).toContain('cover.jpg');
    expect(document.body.textContent).not.toContain('10+ (11)');
  });

  it('keeps Author context mutations visible and disabled', () => {
    renderView('author', vi.fn(), vi.fn(), 'grid', ['file-1']);

    const file = document.querySelector<HTMLElement>('[data-file-viewer-item="file-1"]');
    act(() => file?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 20, clientY: 20 })));

    for (const label of ['Rename', 'Move', 'Delete']) {
      const action = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
        (candidate) => candidate.textContent === label,
      );
      expect(action).not.toBeUndefined();
      expect(action?.getAttribute('data-disabled')).toBe('true');
    }
  });

  it('uses Finder-style item selection and switches between icon and list views', () => {
    const onSelectedItemIdsChange = vi.fn();
    const onViewModeChange = vi.fn();
    renderView('admin', onSelectedItemIdsChange, onViewModeChange);

    expect(document.querySelector('button[aria-label="New folder"]')?.hasAttribute('disabled')).toBe(false);
    const folder = document.querySelector<HTMLElement>('[data-file-viewer-item="folder-1"]');
    const file = document.querySelector<HTMLElement>('[data-file-viewer-item="file-1"]');
    folder?.click();
    expect(onSelectedItemIdsChange).toHaveBeenCalledWith(['folder-1']);

    act(() => file?.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })));
    expect(onSelectedItemIdsChange).toHaveBeenLastCalledWith(['folder-1', 'file-1']);

    const viewMode = document.querySelector('[role="radiogroup"][aria-label="View"]');
    expect(viewMode?.querySelector('input[aria-label="Grid view"]')).toHaveProperty('checked', true);
    act(() => viewMode?.querySelector<HTMLInputElement>('input[aria-label="List view"]')?.click());
    expect(onViewModeChange).toHaveBeenCalledWith('list');
  });

  it('releases item focus and selection when the blank viewer surface is clicked', () => {
    const onSelectedItemIdsChange = vi.fn();
    renderView('admin', onSelectedItemIdsChange, vi.fn(), 'grid', ['file-1']);

    const action = document.querySelector<HTMLButtonElement>('button[aria-label="cover.jpg · Actions"]');
    const surface = document.querySelector<HTMLElement>('[data-file-viewer-surface]');
    act(() => action?.focus());
    expect(document.activeElement).toBe(action);

    act(() => surface?.click());

    expect(document.activeElement).not.toBe(action);
    expect(onSelectedItemIdsChange).toHaveBeenCalledWith([]);
  });

  it('uses the Core DataTable for list view with selection and sortable columns', () => {
    renderView('admin', vi.fn(), vi.fn(), 'list', ['file-1']);

    expect(document.querySelector('[data-file-viewer-grid]')).toBeNull();
    expect(document.querySelector('[data-file-viewer-list] table')).not.toBeNull();
    expect(host?.querySelector('[data-file-manager-view]')?.getAttribute('aria-label')).toBe('Files');
    expect(host?.querySelector('[data-file-viewer-list] [role="region"]')?.getAttribute('aria-label')).toBe(
      'Files · List view',
    );
    const landmarkNames = Array.from(host!.querySelectorAll('[role="region"]'), (region) =>
      region.getAttribute('aria-label'),
    );
    expect(new Set(landmarkNames).size).toBe(landmarkNames.length);
    expect(document.querySelector('input[aria-label="Select all items"]')).not.toBeNull();
    expect(document.querySelector('input[aria-label="Select cover.jpg"]')).not.toBeNull();
    expect(document.querySelector('button[aria-label="Sort by Name"]')).not.toBeNull();
    expect(document.querySelector('button[aria-label="Sort by Size"]')).not.toBeNull();
    expect(document.querySelector('[data-mobile-layout="inline"]')).not.toBeNull();
    expect(document.querySelector('thead')?.textContent).toBe('Name↑TypeSize');
    expect(document.querySelector('[data-datatable-mobile-row="file-1"]')?.textContent).not.toContain('image/jpeg');
    expect(document.body.textContent).not.toContain('10+ (11)');
    expect(document.querySelector('button[aria-label="Move"]')?.hasAttribute('disabled')).toBe(false);
    expect(document.body.textContent).toContain('1 items selected');
  });

  it('labels every Site Settings usage slot and links it to settings', () => {
    const file = rows[1] as FileManagerFileView;
    const siteSettingUsages = Object.keys(labels.usageSlots).map((slot) => ({
      domain: FileUsageDomain.SITE_SETTINGS,
      entityId: 'site-settings-1',
      slot,
      link: '/admin/settings',
      count: 1,
    }));

    renderView('admin', vi.fn(), vi.fn(), 'grid', [], file, siteSettingUsages);

    for (const slotLabel of Object.values(labels.usageSlots)) {
      const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href="/admin/settings"]')).find(
        (candidate) => candidate.textContent === `Site Settings · ${slotLabel}`,
      );
      expect(link).not.toBeUndefined();
    }
    expect(document.body.textContent).not.toContain('Used in: 11');
  });

  it('shows exact Block and Track locators without inventing editor deep-links', () => {
    const file = rows[1] as FileManagerFileView;
    const usages: FileManagerUsageItemView[] = [
      {
        domain: FileUsageDomain.POST,
        entityId: 'post-1',
        slot: 'file',
        blockId: 'block-1',
        blockType: 'file',
        title: 'Shared post',
        link: '/posts/shared-post',
        count: 1,
      },
      {
        domain: FileUsageDomain.POST,
        entityId: 'post-1',
        slot: 'file',
        blockId: 'block-2',
        blockType: 'file',
        title: 'Shared post',
        link: '/posts/shared-post',
        count: 1,
      },
      {
        domain: FileUsageDomain.TRACK,
        entityId: 'track-1',
        slot: 'audio_original',
        title: 'Field recording',
        link: '/releases/release-1',
        count: 1,
      },
    ];

    renderView('admin', vi.fn(), vi.fn(), 'grid', [], file, usages);

    const postLabels = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href="/posts/shared-post"]')).map(
      (link) => link.textContent,
    );
    expect(postLabels).toEqual([
      'Post · Shared post · file · file · block-1',
      'Post · Shared post · file · file · block-2',
    ]);
    expect(document.querySelector<HTMLAnchorElement>('a[href="/releases/release-1"]')?.textContent).toBe(
      'Track · Field recording · audio_original · track-1',
    );
    expect(document.querySelector('a[href*="edit"]')).toBeNull();
  });

  it('shows generated output type, status, and current delivery link', () => {
    const file = {
      ...(rows[1] as FileManagerFileView),
      generatedOutputs: [
        {
          id: 'thumbnail-1',
          type: FileDerivativeType.THUMBNAIL,
          status: MediaProcessingStatus.READY,
          url: 'https://cdn.example.test/asset/thumbnail-1/thumbnail.webp',
        },
      ],
    };

    renderView('admin', vi.fn(), vi.fn(), 'grid', [], file, []);

    expect(document.body.textContent).toContain('Generated outputs');
    const output = document.querySelector<HTMLAnchorElement>(
      'a[href="https://cdn.example.test/asset/thumbnail-1/thumbnail.webp"]',
    );
    expect(output?.textContent).toBe('Thumbnail · Ready');
  });
});
