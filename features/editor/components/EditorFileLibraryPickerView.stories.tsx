import {
  defaultFileBrowserViewSettings,
  fileBrowserViewSettingsLabels,
  type FileBrowserViewOptions,
} from '@/features/file-manager/ui/file-browser-view-settings';
import { withFeatureLabels } from '@/stories/feature-localization';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useArgs, useState } from 'storybook/preview-api';
import { Button } from '@/components/core/Button';
import { TextInput, Textarea } from '@/components/core/Input';
import { BlockingAlertDialog } from '@/components/core/Modal';
import { LayoutStack, LayoutInline } from '@/components/core/Layout';
import type { FileManagerFileRow, FileManagerRow } from '@/lib/actions/file';
import { editorLibraryFileDisplayName } from '../lib/editor-library-file-selection';

import { EditorFileLibraryPickerView } from './EditorFileLibraryPickerView';
import {
  editorFileLibraryPaginatedRows,
  editorFileLibraryNextPageRows,
  editorFileLibraryPickerStoryLabels,
  editorFileLibrarySearchRows,
  isEditorFileLibraryStoryRowDisabled,
} from './EditorFileLibraryPickerView.fixtures';

const librarySegment = { id: 'story-folder-library', name: 'Library' };
const libraryPath = [{ name: 'Files' }, librarySegment];
const browserRows = editorFileLibrarySearchRows
  .slice(0, 4)
  .map((row) => (row.kind === 'folder' ? row : { ...row, folderPath: [librarySegment] }));
const browserArgs = { rows: browserRows, path: libraryPath, total: 4, query: '', searching: false };
const libraryFolder = {
  kind: 'folder' as const,
  id: 'story-folder-library',
  name: 'Library',
  createdAt: null,
  updatedAt: null,
  folderPath: [librarySegment],
};
const storyCatalog = [
  libraryFolder,
  ...editorFileLibraryPaginatedRows.map((row) => browserRows.find((entry) => entry.id === row.id) ?? row),
];

const meta = {
  title: 'Feature/Editor/File Library Picker',
  component: EditorFileLibraryPickerView,
  decorators: [
    withFeatureLabels({
      labels: {
        search: 'fileManager.search',
        searchScope: 'fileManager.searchScope.label',
        currentFolder: 'fileManager.searchScope.currentFolder',
        allFiles: 'fileManager.searchScope.allFiles',
        name: 'fileManager.columns.name',
        type: 'fileManager.columns.type',
        allTypes: 'fileManager.types.all',
        images: 'fileManager.types.images',
        audio: 'fileManager.types.audio',
        video: 'fileManager.types.video',
        documents: 'fileManager.types.documents',
        sortLabel: 'fileManager.sort.label',
        sortName: 'fileManager.sort.name',
        sortNewest: 'fileManager.sort.newest',
        sortOldest: 'fileManager.sort.oldest',
        sortSize: 'fileManager.sort.size',
        sortSmallest: 'fileManager.sort.smallest',
        size: 'fileManager.columns.size',
        location: 'fileManager.columns.location',
        folderType: 'fileManager.types.folder',
        empty: 'fileManager.empty',
        folderNotFound: 'fileManager.folderNotFound',
        selectFile: 'editorCommon.media.ingestDialog.selectFile',
        loading: 'common.states.loading',
        back: 'common.actions.back',
        add: 'common.actions.add',
        loadMore: 'fileManager.actions.loadMore',
        pagination: (t) => ({
          load: t('fileManager.actions.loadMore'),
          loading: t('common.states.loading'),
          end: t('fileManager.pagination.end'),
          retry: t('common.actions.tryAgain'),
          failed: t('fileManager.errors.load'),
        }),
        selectAllRows: 'fileManager.selectAll',
        open: 'fileManager.actions.open',
        preview: 'fileManager.actions.preview',
        download: 'fileManager.actions.download',
        gridView: 'fileManager.actions.gridView',
        listView: 'fileManager.actions.listView',
        viewMode: 'common.actions.view',
        closePreview: 'fileManager.actions.close',
        selectionUnavailableDescription: 'fileManager.selectionUnavailableDescription',
        itemCount: (t) => (count: number) => t('fileManager.itemCount', { count }),
        searchResultCount: (t) => (count: number) => t('fileManager.searchResultCount', { count }),
        selectedCount: (t) => (count: number) => t('fileManager.selectedCount', { count }),
      },
      project: (args, t) => ({
        viewOptions: {
          value: (args.viewOptions as FileBrowserViewOptions | undefined)?.value ?? defaultFileBrowserViewSettings,
          labels: fileBrowserViewSettingsLabels((key) => t(`fileManager.viewSettings.${key}`)),
          onChange: () => {},
        },
        path: (args.path as { id?: string; name: string }[]).map((item, index) =>
          index === 0 && !item.id ? { ...item, name: t('fileManager.root') } : item,
        ),
      }),
    }),
  ],
  render: function FileLibraryBrowser(args, { parameters }) {
    const [, updateArgs] = useArgs();
    const [addedFiles, setAddedFiles] = useState<FileManagerFileRow[]>([]);
    const [report, setReport] = useState<{ title: string; data: string } | null>(null);
    const describeFiles = (files: readonly FileManagerFileRow[]) =>
      files.map((file) => ({ id: file.id, name: editorLibraryFileDisplayName(file) }));
    const selectFiles = (files: FileManagerFileRow[]) => {
      const eligible = files.filter((file) => !args.isRowDisabled(file));
      const selectedFiles = args.allowMultiple ? eligible : eligible.slice(0, 1);
      updateArgs({ selectedFiles });
    };
    const openPath = (path: typeof args.path) => {
      const folderId = path.at(-1)?.id;
      const rows = storyCatalog.filter((row) =>
        row.kind === 'folder' ? row.folderPath?.at(-2)?.id === folderId : row.folderPath?.at(-1)?.id === folderId,
      );
      updateArgs({ path, rows, query: '', searching: false, total: rows.length, hasMore: false });
    };
    const displayName = (row: FileManagerRow) => (row.kind === 'folder' ? row.name : editorLibraryFileDisplayName(row));
    const sourceRows = args.searching && args.searchScope === 'all' ? storyCatalog : args.rows;
    const visibleRows = sourceRows
      .filter((row) => !args.query.trim() || displayName(row).toLowerCase().includes(args.query.trim().toLowerCase()))
      .filter((row) => !args.mimeTypePrefix || row.kind === 'folder' || row.mimeType.startsWith(args.mimeTypePrefix))
      .sort((a, b) => {
        if (a.kind !== b.kind) {
          return a.kind === 'folder' ? -1 : 1;
        }
        const comparison = args.sort.startsWith('created')
          ? Date.parse(a.createdAt ?? '') - Date.parse(b.createdAt ?? '')
          : args.sort.startsWith('size')
            ? (a.kind === 'file' ? a.fileSize : 0) - (b.kind === 'file' ? b.fileSize : 0)
            : displayName(a).localeCompare(displayName(b));
        return args.sort.endsWith('desc') ? -comparison : comparison;
      });
    return (
      <LayoutStack gap="md">
        <EditorFileLibraryPickerView
          {...args}
          rows={visibleRows}
          total={args.hasMore ? args.total : visibleRows.length}
          viewOptions={
            args.viewOptions
              ? {
                  ...args.viewOptions,
                  onChange: (value) =>
                    updateArgs({
                      viewOptions: { ...args.viewOptions!, value },
                      gridColumns: value.columns,
                      viewMode: value.viewMode,
                    }),
                }
              : undefined
          }
          onQueryChange={(query) => updateArgs({ query, searching: Boolean(query.trim()) })}
          onSearchScopeChange={(searchScope) => updateArgs({ searchScope })}
          onMimeTypePrefixChange={(mimeTypePrefix) => updateArgs({ mimeTypePrefix })}
          onSortChange={(sort) => updateArgs({ sort })}
          onViewModeChange={(viewMode) => updateArgs({ viewMode })}
          onOpenPath={(index) => openPath(args.path.slice(0, index + 1))}
          onReturnToParent={() => args.path.length > 1 && openPath(args.path.slice(0, -1))}
          onActivateRow={(row) => {
            if (row.kind === 'folder') {
              const root = args.path[0];
              const fullPath = row.folderPath ?? [...args.path.slice(1), { id: row.id, name: row.name }];
              const rootIndex = root.id ? fullPath.findIndex((item) => item.id === root.id) : -1;
              openPath([root, ...fullPath.slice(rootIndex + 1)]);
              return;
            }
            const current = args.selectedFiles ?? [];
            selectFiles(
              args.allowMultiple
                ? current.some((file) => file.id === row.id)
                  ? current.filter((file) => file.id !== row.id)
                  : [...current, row]
                : [row],
            );
          }}
          onSelectedFilesChange={selectFiles}
          onConfirmFiles={(files) => {
            const eligible = files.filter((file) => !args.isRowDisabled(file));
            const submitted = args.allowMultiple ? eligible : eligible.slice(0, 1);
            if (!args.allowMultiple) {
              updateArgs({ selectedFiles: submitted });
            }
            if (parameters.fileLibraryForm) {
              setAddedFiles((current) =>
                args.allowMultiple
                  ? [...new Map([...current, ...submitted].map((file) => [file.id, file])).values()]
                  : submitted,
              );
            }
            setReport({
              title: args.labels.add,
              data: JSON.stringify(
                {
                  selected: describeFiles(args.allowMultiple ? (args.selectedFiles ?? []) : submitted),
                  added: describeFiles(submitted),
                },
                null,
                2,
              ),
            });
          }}
          onLoadMore={async () => {
            updateArgs({ loadingMore: true, loadMoreError: null });
            await new Promise<void>((resolve) => window.setTimeout(resolve, 300));
            updateArgs({
              rows: [
                ...args.rows,
                ...editorFileLibraryNextPageRows.filter((row) => !args.rows.some((item) => item.id === row.id)),
              ],
              hasMore: false,
              nextPageKey: undefined,
              loadingMore: false,
            });
          }}
        />
        {parameters.fileLibraryForm ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setReport({
                title: 'Submit',
                data: JSON.stringify(
                  {
                    selected: describeFiles(args.selectedFiles ?? []),
                    submitted: describeFiles(addedFiles),
                    fileIds: new FormData(event.currentTarget).getAll('fileIds'),
                  },
                  null,
                  2,
                ),
              });
            }}
          >
            <LayoutStack gap="sm">
              {addedFiles.map((file) => (
                <input key={file.id} type="hidden" name="fileIds" value={file.id} />
              ))}
              <TextInput
                label={args.labels.selectFile}
                readOnly
                value={addedFiles.map(editorLibraryFileDisplayName).join(', ')}
              />
              <LayoutInline>
                <Button type="submit" disabled={addedFiles.length === 0}>
                  Submit
                </Button>
              </LayoutInline>
            </LayoutStack>
          </form>
        ) : null}
        <BlockingAlertDialog
          opened={report !== null}
          title={report?.title ?? ''}
          onAction={() => setReport(null)}
          actionLabel={args.labels.closePreview}
          message={<Textarea aria-label={report?.title ?? ''} readOnly rows={12} value={report?.data ?? ''} />}
        />
      </LayoutStack>
    );
  },
  argTypes: { gridColumns: { control: 'select', options: ['auto', 2, 3, 4, 5, 6] } },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One browser preview supports both views. SingleSelectionForm and MultipleSelectionForm own the form examples; selection changes do not alert. Add reports selected/added files, Submit reports form fileIds. Search pagination, accessible root, loading and empty states remain distinct.',
      },
    },
  },
  args: {
    labels: editorFileLibraryPickerStoryLabels,
    rows: editorFileLibrarySearchRows,
    path: [{ name: 'Files' }],
    query: 'recording',
    searchScope: 'folder',
    mimeTypePrefix: '',
    sort: 'name:asc',
    searching: true,
    total: 12,
    viewMode: 'grid',
    selectedFiles: [],
    allowMultiple: true,
    isRowDisabled: isEditorFileLibraryStoryRowDisabled,
    onQueryChange: () => {},
    onSearchScopeChange: () => {},
    onMimeTypePrefixChange: () => {},
    onSortChange: () => {},
    onOpenPath: () => {},
    onActivateRow: () => {},
    onSelectedFilesChange: () => {},
    onConfirmFiles: () => {},
    onReturnToParent: () => {},
    onLoadMore: async () => {},
    onViewModeChange: () => {},
  },
} satisfies Meta<typeof EditorFileLibraryPickerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SearchResults: Story = { args: { hasMore: false } };
export const PaginatedSearchResults: Story = {
  args: { rows: editorFileLibraryPaginatedRows, total: 52, hasMore: true, nextPageKey: 'fixture-next-page' },
};
export const LoadingMoreSearchResults: Story = {
  args: { ...PaginatedSearchResults.args, loadingMore: true },
};
export const Loading: Story = { args: { loading: true, rows: [] } };
export const Empty: Story = { args: { rows: [], total: 0, hasMore: false } };

export const MultipleSelectionForm: Story = {
  args: { ...browserArgs, viewMode: 'list' },
  parameters: {
    fileLibraryForm: true,
    docs: {
      description: {
        story:
          'Select files, Add them to the form, then Submit. The Add and Submit dialogs report names and IDs; individual selection does not alert. Switch grid/list here to exercise both interaction modes.',
      },
    },
  },
};
export const SingleSelectionForm: Story = {
  args: {
    viewMode: 'list',
    allowMultiple: false,
    ...browserArgs,
  },
  parameters: { fileLibraryForm: true },
};

export const AccessibleRoot: Story = {
  args: { ...browserArgs, path: [librarySegment] },
};

export const Browser: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Browse folders and switch grid/list in this one preview. View settings cover automatic/explicit columns, icon size and spacing. No form harness.',
      },
    },
  },
  args: { ...browserArgs, viewMode: 'grid', gridColumns: 'auto' },
};
