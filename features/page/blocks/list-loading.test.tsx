// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@/test/render';
import { PostListView } from './post-list/View';
import { ProgramEventListView } from './program-event-list/View';
import { ClientMarqueeCanvasPreview } from './client-marquee/Editor';
import { LabelMarqueeCanvasPreview } from './label-marquee/Editor';
import { AuthorListSettingsEditor } from './author-list/Editor';
import { sectionSettingsSchema } from './section-base-schema';
import en from '@/messages/en.json';
import { PostParticipantsDialog } from '@/features/post/PostEditor/PostParticipantsDialog';

const mocks = vi.hoisted(() => ({
  participants: vi.fn(),
  posts: vi.fn(),
  events: vi.fn(),
  clients: vi.fn(),
  labels: vi.fn(),
  authors: vi.fn(),
  candidates: vi.fn(),
}));
vi.mock('@/lib/queries/post-browser', () => ({
  listPublishedPosts: mocks.posts,
  listPostParticipants: mocks.participants,
}));
vi.mock('@/lib/queries/program-event-browser', () => ({ listProgramEventsForBlockBrowser: mocks.events }));
vi.mock('@/lib/queries/client-browser', () => ({ listClientsForSelector: mocks.clients }));
vi.mock('@/lib/queries/label-browser', () => ({ listLabelsForSelector: mocks.labels }));
vi.mock('@/lib/actions/user', () => ({ listAuthorsAction: mocks.authors }));
vi.mock('@/lib/queries/user-browser', () => ({ searchMembers: mocks.candidates }));
vi.mock('@/lib/actions/post', () => ({
  addPostAuthorAction: vi.fn(),
  addPostCollaboratorAction: vi.fn(),
  removePostAuthorAction: vi.fn(),
  removePostCollaboratorAction: vi.fn(),
}));
let client: QueryClient;
afterEach(() => {
  client?.clear();
  vi.resetAllMocks();
  vi.useRealTimers();
});
function renderQueryContent(content: React.ReactElement) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={client}>{content}</QueryClientProvider>);
}
function renderBlock(kind: 'posts' | 'events', props: Record<string, string> = {}) {
  return renderQueryContent(kind === 'posts' ? <PostListView props={props} /> : <ProgramEventListView props={props} />);
}
function authorSettings(allowSharedEdits = true) {
  return (
    <AuthorListSettingsEditor
      sectionId="authors"
      props={{ source: 'selected', authorIds: 'author-1' }}
      settings={sectionSettingsSchema.parse({})}
      allowSharedEdits={allowSharedEdits}
      updateSharedProps={vi.fn()}
      updateLocalizedProps={vi.fn()}
      updateSettings={vi.fn()}
    />
  );
}

describe('Page block initial loading', () => {
  it.each(['posts', 'events'] as const)(
    'distinguishes a pending %s query from failure and offers a pending retry',
    async (kind) => {
      let fail!: (error: Error) => void;
      let finishRetry!: () => void;
      const load = kind === 'posts' ? mocks.posts : mocks.events;
      load
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              fail = reject;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              finishRetry = resolve;
            }),
        );
      const { user, unmount } = renderBlock(kind);
      expect(screen.getByRole('status', { name: en.common.states.loading })).toHaveTextContent(
        en.common.states.loading,
      );
      expect(screen.queryByText(en.common.messages.noPostsFound)).not.toBeInTheDocument();
      await act(async () => fail(new Error('offline')));
      expect(await screen.findByRole('alert')).toBeVisible();
      expect(screen.queryByRole('status', { name: en.common.states.loading })).not.toBeInTheDocument();
      expect(screen.queryByText(en.common.messages.noPostsFound)).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: en.common.actions.tryAgain }));
      expect(load).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('status', { name: en.common.states.loading })).toHaveTextContent(
        en.common.states.loading,
      );
      unmount();
      await act(async () => finishRetry());
    },
  );

  it('shows a real empty post list only after a successful response', async () => {
    let finish!: (data: { posts: []; pagination: { total: number } }) => void;
    mocks.posts.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderBlock('posts');
    expect(screen.queryByText(en.common.messages.noPostsFound)).not.toBeInTheDocument();
    await act(async () => finish({ posts: [], pagination: { total: 0 } }));
    expect(await screen.findByText(en.common.messages.noPostsFound)).toBeVisible();
    expect(screen.queryByRole('status', { name: en.common.states.loading })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('page block cached query content', () => {
  it.each([
    ['posts', false],
    ['events', false],
    ['posts', true],
    ['events', true],
  ] as const)('keeps loaded %s mounted after failed refetch (pagination: %s)', async (kind, pagination) => {
    const title = 'Loaded item';
    const load = kind === 'posts' ? mocks.posts : mocks.events;
    load
      .mockResolvedValueOnce(
        kind === 'posts'
          ? { posts: [{ id: 'post-1', title, authors: [], categories: [], tags: [] }], pagination: { total: 1 } }
          : { events: [{ id: 'event-1', title, href: '/events/event-1' }], pagination: { total: 1 } },
      )
      .mockRejectedValueOnce(new Error('offline'));
    renderBlock(kind, { showPagination: String(pagination), showFeaturedImage: 'false', showImage: 'false' });
    const link = await screen.findByRole('link', { name: title });
    await act(async () => {
      await client.invalidateQueries();
    });
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.getByRole('link', { name: title })).toBe(link);
    expect(screen.getByRole('button', { name: en.common.actions.tryAgain })).toBeEnabled();
  });

  it.each(['posts', 'events'] as const)(
    'retains a successful empty %s response beside refetch errors',
    async (kind) => {
      const load = kind === 'posts' ? mocks.posts : mocks.events;
      load
        .mockResolvedValueOnce(
          kind === 'posts' ? { posts: [], pagination: { total: 0 } } : { events: [], pagination: { total: 0 } },
        )
        .mockRejectedValueOnce(new Error('offline'));
      renderBlock(kind);
      const empty = await screen.findByText(
        kind === 'posts' ? en.common.messages.noPostsFound : en.programEventAdmin.public.empty,
      );
      await act(async () => {
        await client.invalidateQueries();
      });
      expect(await screen.findByRole('alert')).toBeVisible();
      expect(empty).toBeInTheDocument();
    },
  );

  it.each(['clients', 'labels'] as const)(
    'keeps the %s marquee and its paused state after failed refetch',
    async (kind) => {
      mocks[kind]
        .mockResolvedValueOnce([
          { id: 'selected-1', name: 'Selected entity', website: 'https://selected.example' },
          { id: 'other', name: 'Other entity', website: 'https://other.example' },
        ])
        .mockRejectedValueOnce(new Error('offline'));
      const Preview = kind === 'clients' ? ClientMarqueeCanvasPreview : LabelMarqueeCanvasPreview;
      const { user } = renderQueryContent(
        <Preview
          sectionId="marquee"
          settings={sectionSettingsSchema.parse({})}
          props={{ source: 'selected', ids: 'selected-1' }}
        />,
      );
      const pause = await screen.findByRole('button', { name: en.common.motion.pause });
      await user.click(pause);
      const link = screen.getByRole('link', { name: 'Selected entity' });
      expect(screen.queryByRole('link', { name: 'Other entity' })).not.toBeInTheDocument();
      await act(async () => {
        await client.invalidateQueries();
      });
      expect(await screen.findByRole('alert')).toBeVisible();
      expect(screen.getByRole('link', { name: 'Selected entity' })).toBe(link);
      expect(screen.getByRole('button', { name: en.common.motion.resume })).toBe(pause);
    },
  );

  it.each(['clients', 'labels'] as const)('retains the cached empty %s marquee after failed refetch', async (kind) => {
    mocks[kind].mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline'));
    const Preview = kind === 'clients' ? ClientMarqueeCanvasPreview : LabelMarqueeCanvasPreview;
    renderQueryContent(<Preview sectionId="marquee" settings={sectionSettingsSchema.parse({})} props={{}} />);
    const empty = await screen.findByText(en.pageEditor.blockEditor.empty.marqueeItems);
    await act(async () => {
      await client.invalidateQueries();
    });
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(empty).toBeInTheDocument();
  });

  it.each([true, false])(
    'keeps author selections and permissions after failed refetch (editable: %s)',
    async (editable) => {
      mocks.authors
        .mockResolvedValueOnce([{ id: 'author-1', name: 'Loaded author' }])
        .mockRejectedValueOnce(new Error('offline'));
      renderQueryContent(authorSettings(editable));
      const author = await screen.findByText('Loaded author');
      const removeName = 'Remove Loaded author';
      const remove = screen.getByRole('button', { name: removeName });
      if (editable) {
        expect(remove).toBeEnabled();
      } else {
        expect(remove).toBeDisabled();
      }
      await act(async () => {
        await client.invalidateQueries();
      });
      expect(await screen.findByRole('alert')).toBeVisible();
      expect(author).toBeInTheDocument();
      expect(screen.getByRole('button', { name: removeName })).toBe(remove);
      if (editable) {
        expect(remove).toBeEnabled();
      } else {
        expect(remove).toBeDisabled();
      }
    },
  );

  it('retains unavailable author selections when a cached empty response fails to refresh', async () => {
    mocks.authors.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline'));
    renderQueryContent(authorSettings());
    const unavailable = await screen.findByText(en.pageEditor.blockEditor.authorSelection.unavailable);
    await act(async () => {
      await client.invalidateQueries();
    });
    expect(await screen.findByRole('button', { name: en.common.actions.tryAgain })).toBeEnabled();
    expect(unavailable).toBeInTheDocument();
  });

  it('reports author search failure and retries the same candidate lookup', async () => {
    mocks.authors.mockResolvedValue([{ id: 'author-1', name: 'Loaded author' }]);
    mocks.candidates
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([{ id: 'candidate-1', nickname: 'Candidate author', avatarUrl: null }]);
    const { user } = renderQueryContent(authorSettings());
    await screen.findByText('Loaded author');
    const search = screen.getByRole('combobox', { name: en.common.labels.authors });
    await user.click(search);
    vi.useFakeTimers();
    fireEvent.change(search, { target: { value: 'Ca' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    vi.useRealTimers();
    expect(mocks.candidates).toHaveBeenCalledWith('Ca', ['author-1'], 10, true);
    expect(await screen.findByText(en.common.errors.generic)).toBeVisible();
    expect(screen.queryByText(en.searchCombobox.noResults)).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(await screen.findByRole('alert')).toBeVisible();
    await user.click(screen.getByRole('button', { name: en.common.actions.tryAgain }));
    await user.click(search);
    expect(await screen.findByRole('option', { name: 'Candidate author' })).toBeVisible();
    expect(mocks.candidates).toHaveBeenLastCalledWith('Ca', ['author-1'], 10, true);
    expect(screen.getByText('Loaded author')).toBeVisible();
  });
});

describe('PostParticipantsDialog query lifecycle', () => {
  it.each([false, true])('retains admitted participants after failed refetch (empty: %s)', async (empty) => {
    mocks.participants
      .mockResolvedValueOnce(
        empty ? [] : [{ memberId: 'author-1', nickname: 'Minji', role: 'author', hasEffectiveAuthority: true }],
      )
      .mockRejectedValueOnce(new Error('offline'));
    renderQueryContent(
      <PostParticipantsDialog
        opened
        postId="post-1"
        onClose={vi.fn()}
        canAddAuthor
        canRemoveAuthor={false}
        canManageCollaborators={false}
      />,
    );
    const content = empty
      ? await screen.findByText(en.postParticipants.empty)
      : await screen.findByRole('group', { name: 'Minji Author' });
    const member = screen.getByRole('combobox', { name: en.postParticipants.memberLabel });
    expect(member).toBeEnabled();
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['post', 'participants', 'post-1'] });
    });
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(content).toBeInTheDocument();
    expect(member).toBeEnabled();
    if (!empty) {
      expect(within(content).getByRole('button', { name: en.postParticipants.removeAuthor })).toBeDisabled();
      expect(screen.queryByText(en.postParticipants.empty)).not.toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: en.common.actions.tryAgain })).toBeEnabled();
  });
});
