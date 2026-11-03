import type { Meta, StoryObj } from '@storybook/nextjs';
import { FileManagerView, type FileManagerViewProps } from './FileManagerView';
import { useFileManagerI18n } from './i18n';
const noop = () => {};
const viewerRole: FileManagerViewProps['role'] = 'admin';
const file = {
  kind: 'file' as const,
  id: 'notes',
  fileName: 'Notes',
  extension: 'txt',
  mimeType: 'text/plain',
  fileSize: 128,
  createdAt: null,
  updatedAt: null,
  usageCount: 0,
};
function Preview(args: Partial<FileManagerViewProps>) {
  const { labels, errorMessage } = useFileManagerI18n();
  return (
    <FileManagerView
      labels={labels}
      role={viewerRole}
      items={[file]}
      path={[{ name: labels.root }]}
      total={1}
      query=""
      mimeTypePrefix=""
      sort="name:asc"
      viewMode="grid"
      selectedItemIds={[]}
      onQueryChange={noop}
      onMimeTypePrefixChange={noop}
      onSortChange={noop}
      onViewModeChange={noop}
      onSelectedItemIdsChange={noop}
      onOpenPath={noop}
      onReturnToRoot={noop}
      onOpenFolder={noop}
      onOpenFile={noop}
      onCloseFile={noop}
      onUploadRequested={noop}
      onCreateFolder={noop}
      onRenameFolder={noop}
      onMoveFolder={noop}
      onDeleteFolder={noop}
      onRenameFile={noop}
      onMoveSelectedFiles={noop}
      onDeleteSelectedFiles={noop}
      onConfirmMoveHere={noop}
      onCancelMove={noop}
      onLoadMoreDetailUsages={noop}
      onLoadMoreItems={async () => {}}
      {...args}
      detailUsageError={args.detailUsageError ? errorMessage('loadUsages') : undefined}
      error={args.error ? errorMessage('load') : undefined}
    />
  );
}
const meta = {
  title: 'Feature/File Manager/Waiting States',
  component: Preview,
  render: (args) => <Preview {...args} />,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const InitialLoading: Story = { args: { loading: true, items: [] } };
export const FailedList: Story = { args: { error: 'load', items: [] } };
export const UsageLoading: Story = { args: { detailFile: file, detailLoading: true } };
export const UsageFailed: Story = { args: { detailFile: file, detailUsageError: 'loadUsages' } };
export const DeletionInspection: Story = {
  args: { selectedItemIds: ['notes'], mutationLoading: true, deletionInspecting: true },
};
