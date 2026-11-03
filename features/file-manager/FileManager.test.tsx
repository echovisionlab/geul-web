// @vitest-environment jsdom
import { act, fireEvent, render, screen, userEvent, waitFor, within } from '@/test/render';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Code } from '@connectrpc/connect';
import { FileUsageDomain } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { notifications } from '@/components/core/Notification';
import messages from '@/messages/en.json';
import { FileManager } from './FileManager';
import type { FileManagerFileView, FileManagerFolderView } from './model';
const mocks = vi.hoisted(() => ({
  listItems: vi.fn(),
  searchItems: vi.fn(),
  getDeletionImpact: vi.fn(),
  getFile: vi.fn(),
  listUsages: vi.fn(),
  deleteFolder: vi.fn(),
  upload: vi.fn(),
}));
vi.mock('@/lib/hooks/useFileUpload', () => ({ useFileUpload: () => ({ upload: mocks.upload }) }));
vi.mock('@/lib/actions/file', () => ({
  createFileFolderAction: vi.fn(),
  deleteFileFolderAction: mocks.deleteFolder,
  deleteManagedFilesAction: vi.fn(),
  getFileDeletionImpactAction: mocks.getDeletionImpact,
  getManagedFileAction: mocks.getFile,
  listFileManagerItemsAction: mocks.listItems,
  searchFileManagerItemsAction: mocks.searchItems,
  listManagedFileUsagesAction: mocks.listUsages,
  moveFileFolderAction: vi.fn(),
  moveManagedFilesAction: vi.fn(),
  renameFileFolderAction: vi.fn(),
  renameManagedFileAction: vi.fn(),
}));
const errors = messages.fileManager.errors;
const folder: FileManagerFolderView = {
  kind: 'folder',
  id: 'folder-1',
  name: '2026',
  createdAt: null,
  updatedAt: null,
};

function file(id: string): FileManagerFileView {
  return {
    kind: 'file',
    id,
    fileName: id,
    extension: 'png',
    mimeType: 'image/png',
    fileSize: 1,
    createdAt: null,
    updatedAt: null,
    usageCount: 1,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.spyOn(notifications, 'show');
});
afterEach(() => {
  notifications.clean();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function openFile(user: ReturnType<typeof userEvent.setup>, id = 'file-1') {
  await user.dblClick(await screen.findByRole('row', { name: `${id}.png` }));
  return screen.findByRole('dialog', { name: `${id}.png` });
}
async function deleteFolder(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: '2026 · Actions' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
  return screen.findByRole('dialog');
}
describe('FileManager directory loading', () => {
  it('stops loading a file when its details cannot be requested without calling it unused', async () => {
    const opened = file('file-1');
    mocks.listItems.mockResolvedValue({ items: [opened], total: 1, folderNotFound: false });
    mocks.getFile.mockRejectedValue(new Error('offline'));
    mocks.listUsages.mockResolvedValue({ success: true, usages: [] });
    const { user } = render(<FileManager viewerRole="admin" />);
    const dialog = await openFile(user);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(errors.loadUsages);
    expect(within(dialog).queryByText('Not in use')).not.toBeInTheDocument();
    expect(notifications.show).toHaveBeenCalledWith({ tone: 'danger', message: errors.loadFile });
  });
  it('uses the shared initial usage loader while preserving the file preview and metadata', async () => {
    const opened = file('file-1');
    const usage = Promise.withResolvers<{ success: true; usages: [] }>();
    mocks.listItems.mockResolvedValue({ items: [opened], total: 1, folderNotFound: false });
    mocks.getFile.mockResolvedValue({ success: true, file: opened });
    mocks.listUsages.mockReturnValue(usage.promise);
    const { user } = render(<FileManager viewerRole="admin" />);
    const dialog = await openFile(user);
    expect(within(dialog).getByRole('status')).toHaveTextContent('Loading...');
    expect(within(dialog).getByText('image/png')).toBeInTheDocument();
    await act(async () => usage.resolve({ success: true, usages: [] }));
    expect(within(dialog).queryByRole('status')).not.toBeInTheDocument();
    expect(within(dialog).getByText('In use')).toBeInTheDocument();
  });
  it("loads one more page of a file's usages at a time", async () => {
    const opened = file('file-1');
    const nextPage = Promise.withResolvers<{ success: true; usages: [] }>();
    mocks.listItems.mockResolvedValue({ items: [opened], total: 1, folderNotFound: false });
    mocks.getFile.mockResolvedValue({ success: true, file: opened });
    mocks.listUsages
      .mockResolvedValueOnce({
        success: true,
        usages: [],
        nextPageToken: 'usages-2',
      })
      .mockReturnValueOnce(nextPage.promise);
    const { user } = render(<FileManager viewerRole="admin" />);
    const dialog = await openFile(user);
    const more = await within(dialog).findByRole('button', { name: 'Load more' });
    await user.dblClick(more);
    expect(mocks.listUsages).toHaveBeenCalledTimes(2);
    expect(mocks.listUsages).toHaveBeenLastCalledWith({ fileId: 'file-1', pageSize: 25, pageToken: 'usages-2' });
    expect(more).toHaveAttribute('aria-busy', 'true');
    await act(async () => nextPage.resolve({ success: true, usages: [] }));
    expect(within(dialog).queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });
  it('shows deletion inspection pending and stops checking on failure', async () => {
    const selected = file('file-1');
    const inspect = Promise.withResolvers<never>();
    mocks.listItems.mockResolvedValue({ items: [selected], total: 1, folderNotFound: false });
    mocks.getDeletionImpact.mockReturnValue(inspect.promise);
    const { user } = render(<FileManager viewerRole="admin" />);
    await user.click(await screen.findByRole('row', { name: 'file-1.png' }));
    const remove = screen.getByRole('button', { name: 'Delete' });
    await user.click(remove);
    expect(remove).toHaveAttribute('aria-busy', 'true');
    await user.click(remove);
    expect(mocks.getDeletionImpact).toHaveBeenCalledOnce();
    await act(async () => inspect.reject(new Error('offline')));
    expect(remove).not.toHaveAttribute('aria-busy', 'true');
    expect(notifications.show).toHaveBeenCalledWith({ tone: 'danger', message: errors.inspectUsage });
  });
  it('opens breadcrumbs by their root-first location', async () => {
    const child = { ...folder, id: 'folder-2', name: 'March' };
    mocks.listItems
      .mockResolvedValueOnce({ items: [folder], total: 1 })
      .mockResolvedValueOnce({ items: [child], total: 1 })
      .mockResolvedValue({ items: [], total: 0 });
    const { user } = render(<FileManager viewerRole="admin" />);
    await user.dblClick(await screen.findByRole('row', { name: '2026' }));
    await user.dblClick(await screen.findByRole('row', { name: 'March' }));
    await user.click(screen.getByRole('button', { name: '2026' }));
    expect(mocks.listItems).toHaveBeenLastCalledWith(expect.objectContaining({ folderId: 'folder-1' }));
    await user.click(screen.getByRole('button', { name: 'Files' }));
    expect(mocks.listItems).toHaveBeenLastCalledWith(expect.objectContaining({ folderId: undefined }));
  });
  it('stops waiting for a folder deletion that cannot be requested', async () => {
    mocks.listItems.mockResolvedValue({ items: [folder], total: 1 });
    mocks.deleteFolder.mockRejectedValue(new Error('offline'));
    const { user } = render(<FileManager viewerRole="admin" />);
    const dialog = await deleteFolder(user);
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith({ tone: 'danger', message: errors.mutation }));
    expect(mocks.deleteFolder).toHaveBeenCalledWith('folder-1');
    expect(within(dialog).getByRole('button', { name: 'Delete' })).not.toHaveAttribute('aria-busy', 'true');
  });
  it.each([
    [Code.PermissionDenied, 'forbidden'],
    [Code.Unauthenticated, 'unauthorized'],
    [Code.FailedPrecondition, 'deleteFolder'],
    ['ACTION_FAILED', 'deleteFolder'],
  ] as const)('explains a folder deletion that fails with %s', async (errorCode, key) => {
    mocks.listItems.mockResolvedValue({ items: [folder], total: 1 });
    mocks.deleteFolder.mockResolvedValue({ ok: false, error: 'Failed to delete folder', errorCode });
    const { user } = render(<FileManager viewerRole="admin" />);
    const dialog = await deleteFolder(user);
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith({ tone: 'danger', message: errors[key] }));
  });
  it('clears the previous directory before failed navigation and does not claim it is empty', async () => {
    mocks.listItems
      .mockResolvedValueOnce({ items: [folder], total: 1 })
      .mockRejectedValueOnce(new Error('Failed to load directory'));
    const { user } = render(<FileManager viewerRole="admin" />);
    await user.dblClick(await screen.findByRole('row', { name: '2026' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(errors.load);
    expect(screen.queryByRole('row', { name: '2026' })).not.toBeInTheDocument();
    expect(screen.queryByText(messages.fileManager.empty)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2026' })).toBeInTheDocument();
  });
  it('shows at most five exact usages and derives the remainder from all selected files', async () => {
    const files = Array.from({ length: 6 }, (_, index) => file(`file-${index + 1}`));
    mocks.listItems.mockResolvedValue({ items: files, total: files.length });
    mocks.getDeletionImpact.mockResolvedValue({
      success: true,
      impacts: files.map((item, index) => ({
        fileId: item.id,
        totalUsageCount: 1,
        domainCounts: [{ domain: FileUsageDomain.POST, count: 1 }],
        firstUsages: [
          {
            domain: FileUsageDomain.POST,
            entityId: `post-${index + 1}`,
            slot: 'editor',
            title: `Usage ${index + 1}`,
            count: 1,
          },
        ],
        hasMoreUsages: false,
      })),
    });
    const { user } = render(<FileManager viewerRole="admin" />);
    await user.click(await screen.findByRole('row', { name: 'file-1.png' }));
    await user.keyboard('{Shift>}');
    await user.click(screen.getByRole('row', { name: 'file-6.png' }));
    await user.keyboard('{/Shift}');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Total current uses: 6');
    expect(dialog).toHaveTextContent('By domain: Post: 6');
    expect(within(dialog).getByText('Usage 5 · editor')).toBeInTheDocument();
    expect(within(dialog).queryByText(/Usage 6/)).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent('1 more');
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeDisabled();
  });
  it('shows site-wide search results as a list', async () => {
    mocks.listItems.mockResolvedValue({ items: [], total: 0 });
    mocks.searchItems.mockResolvedValue({
      items: [
        {
          ...folder,
          id: 'needle-folder',
          name: 'Needle',
          folderPath: [
            { id: 'library-folder', name: 'Library' },
            { id: 'needle-folder', name: 'Needle' },
          ],
        },
      ],
      total: 12,
      nextPageToken: 'next',
    });
    render(<FileManager viewerRole="author" />);
    await screen.findByText(messages.fileManager.empty);
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole('textbox', { name: messages.fileManager.search }), {
      target: { value: 'NeEdLe' },
    });
    await act(async () => vi.advanceTimersByTimeAsync(300));
    vi.useRealTimers();
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('12 results found')).toBeInTheDocument();
    expect(mocks.searchItems).toHaveBeenCalledWith(expect.objectContaining({ query: 'NeEdLe' }));
  });
  it('shows a failed results page as its translated message and keeps continuation available', async () => {
    mocks.listItems.mockResolvedValue({ items: [], total: 0 });
    mocks.searchItems
      .mockResolvedValueOnce({ items: [file('first')], total: 2, nextPageToken: 'page-2' })
      .mockRejectedValueOnce(new Error('Offline'));
    const { user } = render(<FileManager viewerRole="author" />);
    await screen.findByText(messages.fileManager.empty);
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole('textbox', { name: messages.fileManager.search }), {
      target: { value: 'needle' },
    });
    await act(async () => vi.advanceTimersByTimeAsync(300));
    vi.useRealTimers();
    await user.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText(errors.load)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
