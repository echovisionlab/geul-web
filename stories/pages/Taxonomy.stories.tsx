import { verifyAdminListControls } from './AdminListAccessibility';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GenresPageView } from '@/features/admin/genre/GenresPageView';
import { FormatsPageView } from '@/features/admin/format/FormatsPageView';
import { StylesPageView } from '@/features/admin/style/StylesPageView';
import { CategoriesPageView } from '@/features/admin/category/CategoriesPageView';
import { TagsPageView } from '@/features/admin/tag/TagsPageView';
import { UserTagsPageView } from '@/features/admin/user-tag/UserTagsPageView';
import { LayoutContainer } from '@/components/core/Layout';
import { ServerDataTableNavigationProvider } from '@/features/data-table/ServerDataTable/ServerDataTableNavigation';
import { parseTableQuery } from '@/lib/utils/table-url';
import { tableRows } from './fixtures/table-query';
import { actionFailure, actionSuccess } from '@/lib/actions/action-result';
const initial = [
  {
    id: 'taxonomy-1',
    name: 'Ambient',
    slug: 'ambient',
    description: 'Listening notes',
    releaseCount: 3,
    postCount: 2,
    createdAt: new Date('2026-09-12T10:00:00Z'),
    user_count: 2,
    created_at: new Date('2026-09-12T10:00:00Z'),
  },
];
export function TaxonomyPagePreview({
  domain = 'genres',
  state = 'ready',
}: {
  domain?: 'genres' | 'formats' | 'styles' | 'categories' | 'tags' | 'userTags';
  state?: 'ready' | 'empty' | 'error' | 'mutation-failed';
}) {
  const t = useTranslations('common'),
    admin = useTranslations('adminList.userTags');
  const [rows, setRows] = useState(state === 'empty' ? [] : initial);
  const [url, setUrl] = useState('');
  const params = new URLSearchParams(url),
    query = parseTableQuery(params, domain);
  const result = {
    ...tableRows(
      rows,
      query,
      (row) => `${row.name} ${row.description}`,
      (row, key) =>
        Object.entries(row).find(
          ([name]) => name === key || name.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`) === key,
        )?.[1],
    ),
    ...(state === 'error' ? { error: t('messages.failedToLoad') } : {}),
  };
  const fields = [
    { field: 'name', label: t('labels.name'), type: 'string' as const },
    { field: 'created_at', label: t('labels.created'), type: 'date' as const },
  ];
  const shared = {
    title: t(`entities.${domain}`),
    result,
    searchParams: params.toString(),
    searchPlaceholder: t('actions.searchItems', { items: t(`entities.${domain}`).toLowerCase() }),
    filterFields: fields,
    sortFields: fields.map(({ field, label }) => ({ field, label })),
  };
  const create = async (name: string, description?: string) => {
    if (state === 'mutation-failed') {
      return actionFailure(t('messages.failedToLoad'), 'ACTION_FAILED');
    }
    const item = {
      ...initial[0],
      id: `taxonomy-${rows.length + 1}`,
      name,
      description: description ?? '',
      slug: name.toLowerCase().replaceAll(' ', '-'),
    };
    setRows((current) => [...current, item]);
    return actionSuccess({ data: { id: item.id, name: item.name, slug: item.slug } });
  };
  const update = async (id: string, data: { name?: string; description?: string | null }) => {
    if (state === 'mutation-failed') {
      return actionFailure(t('messages.failedToLoad'), 'ACTION_FAILED');
    }
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              name: data.name ?? row.name,
              description: data.description === undefined ? row.description : (data.description ?? ''),
            }
          : row,
      ),
    );
    return actionSuccess({ success: true as const });
  };
  const remove = async (id: string) => {
    if (state === 'mutation-failed') {
      return actionFailure(t('messages.failedToLoad'), 'ACTION_FAILED');
    }
    setRows((current) => current.filter((row) => row.id !== id));
    return actionSuccess({ success: true as const });
  };
  const bindings = { createAction: create, updateAction: update, deleteAction: remove, refresh: () => {} };
  return (
    <ServerDataTableNavigationProvider
      value={{
        pathname: `/admin/${domain === 'userTags' ? 'user-tags' : domain}`,
        searchParams: params,
        push: (href) => setUrl(new URL(href, 'https://preview.invalid').search),
        refresh: () => {},
      }}
    >
      <LayoutContainer size="wide">
        {domain === 'genres' ? (
          <GenresPageView {...shared} modalBindings={bindings} deleteAction={remove} />
        ) : domain === 'formats' ? (
          <FormatsPageView {...shared} modalBindings={bindings} deleteAction={remove} />
        ) : domain === 'styles' ? (
          <StylesPageView {...shared} modalBindings={bindings} deleteAction={remove} />
        ) : domain === 'categories' ? (
          <CategoriesPageView
            {...shared}
            modalBindings={{ ...bindings, createAction: (data) => create(data.name, data.description) }}
            deleteAction={remove}
          />
        ) : domain === 'tags' ? (
          <TagsPageView
            {...shared}
            modalBindings={{ ...bindings, updateAction: (id, name) => update(id, { name }) }}
            deleteAction={remove}
          />
        ) : (
          <UserTagsPageView
            {...shared}
            description={admin('description')}
            modalBindings={{ createAction: create, deleteAction: remove, refresh: () => {} }}
            deleteAction={remove}
          />
        )}
      </LayoutContainer>
    </ServerDataTableNavigationProvider>
  );
}
const meta = {
  title: 'Pages/Admin/Taxonomy',
  excludeStories: ['TaxonomyPagePreview'],
  component: TaxonomyPagePreview,
  args: { domain: 'genres', state: 'ready' },
  render: (args) => <TaxonomyPagePreview key={`${args.domain}-${args.state}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/admin/genres' } },
    docs: {
      description: {
        component:
          'Six actual production domain PageViews extracted unchanged from admin genre/format/style/category/tag/user-tag server render trees. Actual domain columns/counts/dates, row menus, CRUD dialogs and bulk selection are retained. Local typed callbacks create/edit/delete real fixture rows; actual URL search, scalar/date comparison filters, sort and paging use the shared local transport. User tags intentionally expose create/delete only, matching production. Server validation, authorization/persistence and relation impacts are excluded.',
      },
    },
  },
} satisfies Meta<typeof TaxonomyPagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Genres: Story = { tags: ['a11y-lists'], play: verifyAdminListControls };
export const GenresEmpty: Story = { args: { state: 'empty' } };
export const Formats: Story = { tags: ['a11y-lists'], play: verifyAdminListControls, args: { domain: 'formats' } };
export const FormatsEmpty: Story = { args: { domain: 'formats', state: 'empty' } };
export const Styles: Story = { tags: ['a11y-lists'], play: verifyAdminListControls, args: { domain: 'styles' } };
export const StylesEmpty: Story = { args: { domain: 'styles', state: 'empty' } };
export const Categories: Story = {
  tags: ['a11y-lists'],
  play: verifyAdminListControls,
  args: { domain: 'categories' },
};
export const CategoriesEmpty: Story = { args: { domain: 'categories', state: 'empty' } };
export const Tags: Story = { tags: ['a11y-lists'], play: verifyAdminListControls, args: { domain: 'tags' } };
export const TagsEmpty: Story = { args: { domain: 'tags', state: 'empty' } };
export const UserTags: Story = { tags: ['a11y-lists'], play: verifyAdminListControls, args: { domain: 'userTags' } };
export const UserTagsEmpty: Story = { args: { domain: 'userTags', state: 'empty' } };
export const ReadError: Story = { args: { state: 'error' } };
export const MutationFailed: Story = { args: { state: 'mutation-failed' } };
export const Phone: Story = {
  tags: ['a11y-lists'],
  play: verifyAdminListControls,
  globals: { viewport: { value: 'phone', isRotated: false } },
};
