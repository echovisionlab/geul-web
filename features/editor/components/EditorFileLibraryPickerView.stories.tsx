import type { Meta, StoryObj } from '@storybook/nextjs';

import { EditorFileLibraryPickerView } from './EditorFileLibraryPickerView';
import {
  editorFileLibraryBrowseRows,
  editorFileLibraryPaginatedRows,
  editorFileLibraryPickerStoryLabels,
  editorFileLibrarySearchRows,
  isEditorFileLibraryStoryRowDisabled,
} from './EditorFileLibraryPickerView.fixtures';

const meta = {
  title: 'Feature/Editor/File Library Picker',
  component: EditorFileLibraryPickerView,
  parameters: { layout: 'padded' },
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
    onLoadMore: () => {},
    onViewModeChange: () => {},
  },
} satisfies Meta<typeof EditorFileLibraryPickerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SearchResults: Story = { args: { hasMore: false } };
export const PaginatedSearchResults: Story = {
  args: { rows: editorFileLibraryPaginatedRows, total: 52, hasMore: true },
};
export const Browse: Story = {
  args: {
    rows: editorFileLibraryBrowseRows.slice(0, 2),
    query: '',
    searching: false,
    total: 2,
    path: [{ name: 'Files' }, { id: 'story-folder-library', name: 'Library' }],
  },
};
export const Loading: Story = { args: { loading: true, rows: [] } };
export const Empty: Story = { args: { rows: [], total: 0, hasMore: false } };
