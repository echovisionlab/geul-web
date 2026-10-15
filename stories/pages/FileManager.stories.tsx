import { useMemo, useRef, useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useTranslations } from 'next-intl';
import {
  defaultFileBrowserViewSettings,
  fileBrowserViewSettingsLabels,
} from '@/features/file-manager/ui/file-browser-view-settings';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useFileManagerI18n } from '@/features/file-manager/i18n';
import {
  FileManagerView,
  type FileManagerViewMode,
  type FileManagerPathItem,
} from '@/features/file-manager/FileManagerView';
import type { FileManagerFileView, FileManagerItemView } from '@/features/file-manager/model';
const initialItems: FileManagerItemView[] = [
  { kind: 'folder', id: 'recordings', name: 'Field recordings', createdAt: '2026-10-01T12:00:00Z', updatedAt: null },
  {
    kind: 'file',
    id: 'notes',
    fileName: 'Performance notes',
    extension: 'txt',
    mimeType: 'text/plain',
    fileSize: 2048,
    createdAt: '2026-10-03T09:00:00Z',
    updatedAt: null,
    usageCount: 0,
  },
  {
    kind: 'file',
    id: 'score',
    fileName: 'Score',
    extension: 'pdf',
    mimeType: 'application/pdf',
    fileSize: 124000,
    createdAt: '2026-10-04T10:00:00Z',
    updatedAt: null,
    usageCount: 1,
  },
  {
    kind: 'file',
    id: 'session',
    folderId: 'recordings',
    fileName: 'Session A',
    extension: 'wav',
    mimeType: 'audio/wav',
    fileSize: 2400000,
    createdAt: '2026-10-05T10:00:00Z',
    updatedAt: null,
    usageCount: 0,
  },
];
function FileManagerPagePreview({
  role = 'admin',
  initialView = 'grid',
  state = 'ready',
}: {
  role?: 'admin' | 'author';
  initialView?: FileManagerViewMode;
  state?: 'ready' | 'empty' | 'error' | 'loading' | 'detail';
}) {
  const { labels } = useFileManagerI18n();
  const viewText = useTranslations('fileManager.viewSettings');
  const [viewSettings, setViewSettings] = useState(defaultFileBrowserViewSettings);
  const [items, setItems] = useState(state === 'empty' ? [] : initialItems);
  const [path, setPath] = useState<FileManagerPathItem[]>([]);
  const [query, setQuery] = useState('');
  const [mime, setMime] = useState('');
  const [sort, setSort] = useState('name:asc');
  const [view, setView] = useState(initialView);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<FileManagerFileView | null>(
    state === 'detail' ? (initialItems[1] as FileManagerFileView) : null,
  );
  const [pendingMove, setPendingMove] = useState<string[] | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const current = path.at(-1)?.id;
  const visible = useMemo(
    () =>
      items
        .filter((item) =>
          query
            ? (item.kind === 'folder' ? item.name : item.fileName).toLowerCase().includes(query.toLowerCase())
            : (item.kind === 'folder' ? item.parentId : item.folderId) === current,
        )
        .filter((item) => !mime || item.kind === 'folder' || item.mimeType.startsWith(mime))
        .sort((a, b) => {
          if (a.kind !== b.kind) {
            return a.kind === 'folder' ? -1 : 1;
          }
          const name = (item: FileManagerItemView) => (item.kind === 'folder' ? item.name : item.fileName);
          const compare = sort.startsWith('created')
            ? Date.parse(a.createdAt ?? '') - Date.parse(b.createdAt ?? '')
            : sort.startsWith('size')
              ? (a.kind === 'file' ? a.fileSize : 0) - (b.kind === 'file' ? b.fileSize : 0)
              : name(a).localeCompare(name(b));
          return sort.endsWith('desc') ? -compare : compare;
        }),
    [items, current, query, mime, sort],
  );
  const remove = (ids: string[]) => {
    setItems((previous) => previous.filter((item) => !ids.includes(item.id)));
    setSelected([]);
  };
  return (
    <>
      <input
        ref={uploadInput}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          setItems((previous) => [
            ...previous,
            ...files.map((file): FileManagerFileView => {
              const extension = file.name.includes('.') ? file.name.split('.').at(-1)! : '';
              const url = URL.createObjectURL(file);
              return {
                kind: 'file',
                id: `uploaded-${crypto.randomUUID()}`,
                folderId: current,
                fileName: extension ? file.name.slice(0, -(extension.length + 1)) : file.name,
                extension,
                mimeType: file.type || 'application/octet-stream',
                fileSize: file.size,
                createdAt: new Date().toISOString(),
                updatedAt: null,
                usageCount: 0,
                inlineUrl: url,
                downloadUrl: url,
                playbackUrl: url,
                thumbnailUrl: file.type.startsWith('image/') ? url : undefined,
              };
            }),
          ]);
          event.currentTarget.value = '';
        }}
      />
      <FileManagerView
        labels={labels}
        role={role}
        items={visible}
        path={[{ name: labels.root }, ...path]}
        total={visible.length}
        query={query}
        mimeTypePrefix={mime}
        sort={sort}
        viewMode={view}
        viewOptions={{
          value: { ...viewSettings, viewMode: view },
          labels: fileBrowserViewSettingsLabels(viewText),
          onChange: (next) => {
            setViewSettings(next);
            setView(next.viewMode);
          },
        }}
        selectedItemIds={selected}
        detailFile={detail}
        loading={state === 'loading'}
        error={state === 'error' ? labels.folderNotFound : null}
        uploadPercentage={null}
        movePendingLabel={pendingMove ? labels.chooseDestination : null}
        onQueryChange={setQuery}
        onMimeTypePrefixChange={setMime}
        onSortChange={setSort}
        onViewModeChange={setView}
        onSelectedItemIdsChange={setSelected}
        onOpenPath={(index) => {
          setPath((previous) => previous.slice(0, index));
          setSelected([]);
        }}
        onReturnToRoot={() => setPath([])}
        onOpenFolder={(folder) => {
          setPath((previous) => [...previous, { id: folder.id, name: folder.name }]);
          setSelected([]);
        }}
        onOpenFile={setDetail}
        onCloseFile={() => setDetail(null)}
        onUploadRequested={() => uploadInput.current?.click()}
        onCreateFolder={() =>
          setItems((previous) => [
            ...previous,
            {
              kind: 'folder',
              id: `folder-${previous.length}`,
              parentId: current,
              name: `${labels.newFolder} ${previous.length}`,
              createdAt: '2026-10-10T12:00:00Z',
              updatedAt: null,
            },
          ])
        }
        onRenameFolder={(folder) =>
          setItems((previous) =>
            previous.map((item) => (item.id === folder.id ? { ...folder, name: `${folder.name} · 2` } : item)),
          )
        }
        onMoveFolder={(folder) => setPendingMove([folder.id])}
        onDeleteFolder={(folder) => remove([folder.id])}
        onRenameFile={(file) =>
          setItems((previous) =>
            previous.map((item) => (item.id === file.id ? { ...file, fileName: `${file.fileName} · 2` } : item)),
          )
        }
        onMoveSelectedFiles={() => setPendingMove(selected)}
        onDeleteSelectedFiles={() => remove(selected)}
        onConfirmMoveHere={() => {
          setItems((previous) =>
            previous.map((item) =>
              pendingMove?.includes(item.id) && item.id !== current
                ? item.kind === 'folder'
                  ? { ...item, parentId: current }
                  : { ...item, folderId: current }
                : item,
            ),
          );
          setPendingMove(null);
          setSelected([]);
        }}
        onCancelMove={() => setPendingMove(null)}
        onLoadMoreDetailUsages={() => {}}
        onLoadMoreItems={async () => {}}
      />
    </>
  );
}
const meta = {
  title: 'Pages/Admin/File Manager',
  component: FileManagerPagePreview,
  decorators: [
    (Story, context) => <Story key={`${context.args.state}:${context.args.role}:${context.args.initialView}`} />,
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Actual FileManagerView shared by /admin/files and /files. Global locale/theme feed the production i18n hook and Core owners. Local fixture supports folder navigation, grid/list, search, type, sort, selection, create/rename/delete/move detail open/close and selected file uploads with object URLs. Authenticated route/server queries, persistent mutations, confirmation controller and application shell are outside this preview.',
      },
    },
  },
} satisfies Meta<typeof FileManagerPagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Browser: Story = {};
export const Detail: Story = { args: { state: 'detail' } };
export const Empty: Story = { args: { state: 'empty' } };
export const Error: Story = { args: { state: 'error' } };
export const Loading: Story = { args: { state: 'loading' } };
export const Author: Story = { args: { role: 'author' } };

export const List: Story = { args: { initialView: 'list' } };

export const InsetAlignment: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const header = canvasElement.querySelector<HTMLElement>('[data-file-browser-header]')!;
    // Core SegmentedControl renders each view choice as a labelled radio.
    const viewButtons = header.querySelectorAll<HTMLLabelElement>(
      '[data-file-browser-view-toggle] [role="radiogroup"] label',
    );
    const contentEdges = (selector: string) => {
      const content = canvasElement.querySelector<HTMLElement>(selector)!;
      const toolbarBounds = header.getBoundingClientRect();
      const contentBounds = content.getBoundingClientRect();
      expect(toolbarBounds.width).toBeGreaterThan(0);
      expect(contentBounds.width).toBeGreaterThan(0);
      expect(Math.abs(contentBounds.left - toolbarBounds.left)).toBeLessThan(1);
      expect(Math.abs(contentBounds.right - toolbarBounds.right)).toBeLessThan(1);
    };
    await step('Keep the grid on the same content edges as the toolbar', async () => {
      contentEdges('[data-file-viewer-grid]');
      const notes = canvas.getByRole('row', { name: 'Performance notes.txt' });
      await userEvent.click(notes);
      await expect(notes).toHaveAttribute('aria-selected', 'true');
    });
    await step('Keep list edges aligned and preserve selection when switching layouts', async () => {
      await userEvent.click(viewButtons[1]);
      await waitFor(() => expect(canvasElement.querySelector('[data-file-viewer-list]')).not.toBeNull());
      contentEdges('[data-file-viewer-list]');
      await userEvent.click(viewButtons[0]);
      const notes = canvas.getByRole('row', { name: 'Performance notes.txt' });
      await expect(notes).toHaveAttribute('aria-selected', 'true');
      contentEdges('[data-file-viewer-grid]');
    });
  },
};

export const KeyboardBrowser: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const browser = canvas.getByRole('grid');
    const items = within(browser).getAllByRole('row');
    const notes = within(browser).getByRole('row', { name: 'Performance notes.txt' });
    await step('Traverse and select files without opening a preview', async () => {
      items[0].focus();
      await userEvent.keyboard('{ArrowRight}');
      await waitFor(() => expect(notes).toHaveFocus());
      await userEvent.keyboard(' ');
      await expect(notes).toHaveAttribute('aria-selected', 'true');
      await expect(within(document.body).queryByRole('dialog')).not.toBeInTheDocument();
    });
    await step('Operate a file action menu independently of selection and preview', async () => {
      const actions = within(notes).getByRole('button');
      actions.focus();
      await userEvent.keyboard('{Enter}');
      const menu = await within(document.body).findByRole('menu');
      await waitFor(() => expect(menu).toBeVisible());
      await expect(notes).toHaveAttribute('aria-selected', 'true');
      await expect(within(document.body).queryByRole('dialog')).not.toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(menu).not.toBeInTheDocument());
      await waitFor(() => expect(actions).toHaveFocus());
      notes.focus();
    });
    await step('Open the selected file through its independent activation command', async () => {
      await userEvent.keyboard('{Enter}');
      const detail = await within(document.body).findByRole('dialog', { name: 'Performance notes.txt' });
      await waitFor(() => expect(detail).toBeVisible());
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(detail).not.toBeInTheDocument());
      await waitFor(() => expect(notes).toHaveFocus());
    });
  },
};
