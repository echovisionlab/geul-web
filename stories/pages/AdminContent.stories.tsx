import { verifyAdminListControls } from './AdminListAccessibility';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { navigatePreview } from '../shared/preview-navigation';
import { createTranslator, useTranslations } from 'next-intl';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import { LayoutContainer } from '@/components/core/Layout';
import { PostsPageView } from '@/features/admin/post/PostsPageView';
import { PagesPageView } from '@/features/admin/cms-page/PagesPageView';
import { ServerDataTableNavigationProvider } from '@/features/data-table/ServerDataTable/ServerDataTableNavigation';
import { parseTableQuery } from '@/lib/utils/table-url';
import { tableRows } from './fixtures/table-query';
import { actionSuccess, actionFailure } from '@/lib/actions/action-result';
const date = new Date('2026-09-12T10:00:00Z');
const posts = [
  {
    id: 'post-1',
    title: 'Listening Notes',
    slug: 'listening-notes',
    status: 'published',
    createdAt: date.toISOString(),
    updatedAt: date.toISOString(),
    author: { id: 'member-1', name: 'June Han', avatarUrl: undefined },
  },
  { id: 'post-2', title: 'First Draft', slug: undefined, status: 'draft', createdAt: undefined, updatedAt: undefined },
];
const pages = [
  {
    id: 'page-1',
    title: 'Listening Room',
    slug: 'listening-room',
    status: 'published',
    createdAt: date,
    updatedAt: date,
  },
  { id: 'page-2', title: 'First Draft', slug: null, status: 'draft', createdAt: date, updatedAt: null },
];
export function AdminContentPreview({
  domain = 'posts',
  state = 'ready',
}: {
  domain?: 'posts' | 'pages';
  state?: 'ready' | 'empty' | 'error' | 'create-failed';
}) {
  const t = useTranslations('common');
  const [url, setUrl] = useState('');
  const [postRows, setPostRows] = useState(state === 'empty' ? [] : posts);
  const [pageRows, setPageRows] = useState(state === 'empty' ? [] : pages);
  const params = new URLSearchParams(url),
    query = parseTableQuery(params, domain);
  const result = <T extends { id: string }>(rows: T[]) => ({
    ...tableRows(
      rows,
      query,
      (row) =>
        Object.values(row)
          .filter((v) => typeof v === 'string')
          .join(' '),
      (row, key) =>
        Object.entries(row).find(
          ([name]) => name === key || name.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`) === key,
        )?.[1],
    ),
    ...(state === 'error' ? { error: t('messages.failedToLoad') } : {}),
  });
  const fields = [
    { field: 'title', label: t('labels.title'), type: 'string' as const },
    {
      field: 'status',
      label: t('labels.status'),
      type: 'string' as const,
      options: [
        { value: 'draft', label: t('statuses.draft') },
        { value: 'published', label: t('statuses.published') },
      ],
    },
  ];
  const shared = {
    title: t(`entities.${domain}`),
    searchParams: params.toString(),
    searchPlaceholder: t('actions.searchItems', { items: t(`entities.${domain}`).toLowerCase() }),
    filterFields: fields,
    sortFields: fields.map(({ field, label }) => ({ field, label })),
  };
  const deletePost = async (id: string) => {
    setPostRows((rows) => rows.filter((row) => row.id !== id));
    return actionSuccess({ success: true as const });
  };
  const deletePage = async (id: string) => {
    setPageRows((rows) => rows.filter((row) => row.id !== id));
    return actionSuccess({ success: true as const });
  };
  return (
    <ServerDataTableNavigationProvider
      value={{
        pathname: `/admin/${domain}`,
        searchParams: params,
        push: (href) => setUrl(new URL(href, 'https://preview.invalid').search),
        refresh: () => {},
      }}
    >
      <LayoutContainer size="wide">
        {domain === 'posts' ? (
          <PostsPageView
            {...shared}
            result={result(postRows)}
            createBindings={{
              createAction: async () => {
                if (state === 'create-failed') {
                  return actionFailure(t('messages.failedToLoad'), 'POST_CREATE_FAILED');
                }
                setPostRows((rows) => [
                  ...rows,
                  {
                    ...posts[1],
                    id: `post-${rows.length + 1}`,
                    title: t('actions.newItem', { item: t('entities.post') }),
                  },
                ]);
                return actionSuccess({ data: { id: 'local-post' } });
              },
              onCreated: () => {},
            }}
            deleteAction={deletePost}
            modalBindings={{ deleteAction: deletePost, onDeleted: () => {} }}
          />
        ) : (
          <PagesPageView
            {...shared}
            result={result(pageRows)}
            createBindings={{
              createAction: async () => {
                if (state === 'create-failed') {
                  return actionFailure(t('messages.failedToLoad'), 'PAGE_CREATE_FAILED');
                }
                setPageRows((rows) => [
                  ...rows,
                  {
                    ...pages[1],
                    id: `page-${rows.length + 1}`,
                    title: t('actions.newItem', { item: t('entities.page') }),
                  },
                ]);
                return actionSuccess({ data: { id: 'local-page', slug: null } });
              },
              navigate: navigatePreview,
            }}
            deleteAction={deletePage}
            modalBindings={{ deleteAction: deletePage, refresh: () => {} }}
          />
        )}
      </LayoutContainer>
    </ServerDataTableNavigationProvider>
  );
}
const meta = {
  title: 'Pages/Admin/Content Lists',
  excludeStories: ['AdminContentPreview'],
  component: AdminContentPreview,
  args: { domain: 'posts', state: 'ready' },
  render: (args) => <AdminContentPreview key={`${args.domain}-${args.state}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/admin/posts' } },
    docs: {
      description: {
        component:
          'Production PostsPageView/PagesPageView extracted unchanged from their server route render trees, using actual domain columns, authors/date/status, row menus, creation/deletion controllers, bulk selection and URL query controls. Local typed actions add/remove fixture rows, scalar search/filter/sort/paging. Server access, draft editor navigation, storage/persistence and metadata remain outside.',
      },
    },
  },
} satisfies Meta<typeof AdminContentPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Posts: Story = { tags: ['a11y-lists'], play: verifyAdminListControls };
export const PostsEmpty: Story = { args: { state: 'empty' } };
export const PostsError: Story = { args: { state: 'error' } };
export const PostCreateFailed: Story = { args: { state: 'create-failed' } };
export const Pages: Story = { tags: ['a11y-lists'], play: verifyAdminListControls, args: { domain: 'pages' } };
export const PagesEmpty: Story = { args: { domain: 'pages', state: 'empty' } };
export const PagesError: Story = { args: { domain: 'pages', state: 'error' } };
export const PageCreateFailed: Story = { args: { domain: 'pages', state: 'create-failed' } };
export const Phone: Story = {
  tags: ['a11y-lists'],
  play: verifyAdminListControls,
  globals: { viewport: { value: 'phone', isRotated: false } },
};

async function verifyContentDeletion({
  canvasElement,
  globals,
  args,
}: {
  canvasElement: HTMLElement;
  globals: Record<string, unknown>;
  args: { domain?: 'posts' | 'pages' };
}) {
  const locale = normalizeLocale(typeof globals.locale === 'string' ? globals.locale : '') ?? DEFAULT_LOCALE;
  const { default: messages } = await import(`../../messages/${locale}.json`);
  const common = createTranslator({ locale, messages, namespace: 'common' });
  const table = createTranslator({ locale, messages, namespace: 'dataTable' });
  const name = args.domain === 'pages' ? 'Listening Room' : 'Listening Notes';
  const canvas = within(canvasElement);
  const label = table('aria.rowActions', { label: name });
  const trigger = await canvas.findByRole('button', { name: label });
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  const menu = await within(document.body).findByRole('menu');
  const deletion = within(menu).getByRole('menuitem', { name: common('actions.delete') });
  deletion.focus();
  await userEvent.keyboard('{Enter}');
  const dialog = await within(document.body).findByRole('dialog', { name: common('actions.delete') });
  await expect(dialog).toHaveTextContent(name);
  const confirm = within(dialog).getByRole('button', { name: common('actions.delete') });
  confirm.focus();
  await userEvent.keyboard('{Enter}');
  await waitFor(() => expect(canvas.queryByRole('button', { name: label })).not.toBeInTheDocument());
  await waitFor(() => expect(canvasElement.contains(document.activeElement)).toBe(true));
}

export const KeyboardPostDeletion: Story = { tags: ['a11y-lists'], play: verifyContentDeletion };
export const KeyboardPageDeletion: Story = {
  args: { domain: 'pages' },
  tags: ['a11y-lists'],
  play: verifyContentDeletion,
};
