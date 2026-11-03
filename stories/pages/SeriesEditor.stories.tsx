import { publicAccessibilityLabels } from '@/stories/shared/public-accessibility';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { notifications } from '@/components/core/Notification';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { goBackPreview } from '../shared/preview-navigation';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { LayoutContainer } from '@/components/core/Layout';
import { SeriesDetailView, type SeriesDetailViewModel } from '@/features/series/SeriesDetail';
import type { SeriesManagerBindings } from '@/features/series/SeriesManagersModal';
import type { SeriesStatus } from '@/lib/types/series/model';
import { localEditLocale, localEditorQueryClient } from './fixtures/editor-pages';
import { actionSuccess } from '@/lib/actions/action-result';
const initialPosts: SeriesDetailViewModel['posts'] = [
  {
    id: 'room-1',
    title: 'The opening room',
    slug: 'opening',
    status: 'published',
    seriesOrder: 0,
    publishedAt: new Date('2026-10-01T00:00:00Z'),
  },
  { id: 'room-2', title: 'The closing room', slug: 'closing', status: 'draft', seriesOrder: 1, publishedAt: undefined },
];
const postsQueryKey = ['series', 'local-series', 'posts'];
function Preview({
  scope = 'admin',
  state = 'ready',
}: {
  scope?: 'admin' | 'my';
  state?: 'ready' | 'empty' | 'disconnected' | 'posts-loading' | 'posts-error' | 'removing-post';
}) {
  const [client] = useState(() => localEditorQueryClient('post_series', 'local-series'));
  const failNextPostsRequest = useRef(state === 'posts-error');
  const postsQuery = useQuery(
    {
      queryKey: postsQueryKey,
      queryFn: async () => {
        if (state === 'posts-loading') {
          return new Promise<SeriesDetailViewModel['posts']>(() => {});
        }
        if (failNextPostsRequest.current) {
          failNextPostsRequest.current = false;
          throw new Error('Fixture series posts load failed');
        }
        return initialPosts;
      },
      initialData:
        state === 'posts-loading' || state === 'posts-error' ? undefined : state === 'empty' ? [] : initialPosts,
    },
    client,
  );
  const { data: posts = [] } = postsQuery;
  const [title, setTitle] = useState('Listening room'),
    [description, setDescription] = useState('A monthly series of evening performances.'),
    [slug, setSlug] = useState('listening-room'),
    [locale, setLocale] = useState('ko');
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<SeriesStatus>('published'),
    [safePostsPage, setPostsPage] = useState(1),
    [managersOpened, setManagers] = useState(false);
  const tCommon = useTranslations('common'),
    tCommonLabels = useTranslations('common.labels'),
    tFeaturedImage = useTranslations('featuredImage'),
    t = useTranslations('seriesDetail'),
    tActions = useTranslations('common.actions'),
    tPagination = useTranslations('dataTable.pagination'),
    tStatuses = useTranslations('common.statuses');
  const managers = useRef([
    { memberId: 'local-manager', nickname: 'June Han', avatarUrl: undefined, createdAt: undefined },
  ]);
  const managerBindings: SeriesManagerBindings = {
    list: async () => managers.current,
    search: async () => [{ id: 'local-reader', nickname: 'Studio reader', avatarUrl: null }],
    add: async (_id, memberId) => {
      managers.current = [
        ...managers.current,
        { memberId, nickname: 'Studio reader', avatarUrl: undefined, createdAt: undefined },
      ];
      return actionSuccess({ success: true as const });
    },
    remove: async (_id, memberId) => {
      managers.current = managers.current.filter((x) => x.memberId !== memberId);
      return actionSuccess({ success: true as const });
    },
  };
  const connected = state !== 'disconnected';
  const model: SeriesDetailViewModel = {
    kind: 'ready',
    collaboration: {
      provider: null,
      isConnected: connected,
      isSynced: connected,
      setField: (field, value) => {
        if (field === 'summary') {
          setDescription(value);
        }
      },
    },
    seriesId: 'local-series',
    displayedTitle: title,
    handleTitleChange: setTitle,
    tCommon,
    canEdit: connected,
    canEditCurrentCopy: connected,
    activeEditLocale: localEditLocale(locale, setLocale),
    status,
    seriesStatusOptions: [
      { value: 'draft', label: tStatuses('draft'), actionLabel: tStatuses('draft'), tone: 'neutral' },
      { value: 'published', label: tStatuses('published'), actionLabel: tStatuses('published'), tone: 'positive' },
    ],
    handleBack: async () => goBackPreview(),
    handleStatusChange: async (value) => setStatus(value),
    changeStatus: { isPending: false },
    tCommonLabels,
    openManagers: () => setManagers(true),
    ogImage: { src: undefined, isRegenerating: false, status: undefined, error: undefined, targetKey: 'local-series' },
    canRegenerateOg: false,
    regenerateOgImage: { isPending: false, mutate: () => {} },
    featuredImageUrl,
    isUploading: false,
    uploadProgress: 0,
    removeFeaturedImage: { isPending: false, mutate: () => setFeaturedImageUrl(null) },
    handleFeaturedImageUpload: async (blob) => {
      setFeaturedImageUrl(URL.createObjectURL(blob));
    },
    tFeaturedImage,
    slug,
    slugMgmt: { handleChange: setSlug, error: undefined, isChecking: false, isAvailable: true },
    t,
    displayedDescription: description,
    handleSave: async () => {
      notifications.show({ tone: 'positive', message: tActions('save') });
    },
    updateSeries: { isPending: false },
    tActions,
    scope,
    posts,
    postsQuery: {
      isLoading: postsQuery.isLoading,
      isError: postsQuery.isError,
      error: postsQuery.error,
      isFetching: postsQuery.isFetching,
      refetch: postsQuery.refetch,
    },
    postsPerPage: 10,
    totalPostPages: Math.max(1, Math.ceil(posts.length / 10)),
    safePostsPage,
    setPostsPage,
    tPagination,
    pagedPosts: posts.slice((safePostsPage - 1) * 10, safePostsPage * 10),
    tStatuses,
    reorderPosts: { isPending: false },
    movePost: (id, direction) =>
      client.setQueryData<SeriesDetailViewModel['posts']>(postsQueryKey, (items = []) => {
        const next = [...items],
          index = next.findIndex((x) => x.id === id),
          target = direction === 'up' ? index - 1 : index + 1;
        if (target >= 0 && target < next.length) {
          [next[index], next[target]] = [next[target], next[index]];
        }
        return next;
      }),
    unassignPost: {
      isPending: state === 'removing-post',
      variables: state === 'removing-post' ? 'room-2' : undefined,
      mutate: (id) =>
        client.setQueryData<SeriesDetailViewModel['posts']>(postsQueryKey, (items = []) =>
          items.filter((x) => x.id !== id),
        ),
    },
    managersOpened,
    closeManagers: () => setManagers(false),
    canManageManagers: scope === 'admin',
  };
  return (
    <QueryClientProvider client={client}>
      <LayoutContainer size="wide" inset="md">
        <SeriesDetailView model={model} managerBindings={managerBindings} />
      </LayoutContainer>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Editors/Series',
  component: Preview,
  args: { scope: 'admin', state: 'ready' },
  render: (args) => <Preview key={`${args.scope}-${args.state}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Production series detail view with local title, description, slug, poster upload/removal, ordered posts and manager CRUD. Service-backed translation panels are omitted.',
      },
    },
  },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Admin: Story = {};
export const Mine: Story = { args: { scope: 'my' } };
export const Empty: Story = { args: { state: 'empty' } };
export const Disconnected: Story = { args: { state: 'disconnected' } };
export const PostsLoading: Story = { args: { state: 'posts-loading' } };
export const PostsLoadFailed: Story = { args: { state: 'posts-error' } };
export const RemovingPost: Story = { args: { state: 'removing-post' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const KeyboardMineAuthoring: Story = {
  args: { scope: 'my' },
  tags: ['a11y-public'],
  play: async ({ canvasElement, globals }) => {
    const t = await publicAccessibilityLabels(globals);
    const canvas = within(canvasElement);
    const slug = canvas.getByRole('textbox', { name: t('common.labels.slug') });
    await expect(slug).toHaveValue('listening-room');
    const table = canvas.getByRole('table', { name: t('seriesDetail.posts.title', { count: 2 }) });
    const firstRow = within(table).getByRole('row', { name: /The opening room/ });
    const move = within(firstRow).getByRole('button', { name: t('seriesDetail.posts.actions.moveDown') });
    await expect(move).toHaveAccessibleDescription(/The opening room.*#1/);
    move.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: t('seriesDetail.posts.actions.moveUp'), description: /The opening room/ }),
      ).toHaveFocus(),
    );
    const movedRow = within(table).getByRole('row', { name: /The opening room/ });
    await expect(within(movedRow).getByText('#2')).toBeInTheDocument();
    const remove = within(movedRow).getByRole('button', { name: t('seriesDetail.posts.actions.remove') });
    remove.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(canvas.getByRole('link', { name: 'The closing room' })).toHaveFocus());
    await expect(canvas.getByRole('table', { name: t('seriesDetail.posts.title', { count: 1 }) })).toBeInTheDocument();
  },
};
export const KeyboardManagerRemoval: Story = {
  tags: ['a11y-public'],
  play: async ({ canvasElement, globals }) => {
    const t = await publicAccessibilityLabels(globals);
    const canvas = within(canvasElement);
    const managers = canvas.getByRole('button', { name: t('common.labels.managers') });
    managers.focus();
    await userEvent.keyboard('{Enter}');
    const document = within(canvasElement.ownerDocument.body);
    const dialog = await document.findByRole('dialog', { name: t('seriesMembers.title', { count: 1 }) });
    const remove = await within(dialog).findByRole('button', { name: t('common.actions.remove') });
    await expect(remove).toHaveAccessibleDescription('June Han');
    remove.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(document.getByRole('combobox', { name: t('common.placeholders.searchByName') })).toHaveFocus(),
    );
    await expect(document.getByRole('dialog', { name: t('seriesMembers.title', { count: 0 }) })).toBeInTheDocument();
    const search = document.getByRole('combobox', { name: t('common.placeholders.searchByName') });
    if (search.getAttribute('aria-expanded') === 'true') {
      await userEvent.keyboard('{Escape}');
      await expect(search).toHaveAttribute('aria-expanded', 'false');
    }
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(managers).toHaveFocus());
  },
};
