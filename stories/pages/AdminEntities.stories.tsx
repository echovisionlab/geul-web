import { verifyAdminListControls } from './AdminListAccessibility';
import { parseTableQuery } from '@/lib/utils/table-url';
import { ServerDataTableNavigationProvider } from '@/features/data-table/ServerDataTable/ServerDataTableNavigation';
import { tableRows } from './fixtures/table-query';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutContainer, LayoutStack } from '@/components/core/Layout';
import { Alert } from '@/components/core/Alert';
import { ArtistsPageView } from '@/features/admin/artist/ArtistsPageView';
import { LabelsPageView } from '@/features/admin/label/LabelsPageView';
import { ReleasesPageView } from '@/features/admin/release/ReleasesPageView';
import { actionFailure, actionSuccess } from '@/lib/actions/action-result';

const date = new Date('2026-09-12T10:00:00Z');
const artistRows = [
  {
    id: 'artist-1',
    name: 'June Han',
    slug: 'june-han',
    imageUrl: null,
    status: 'published',
    releaseCount: 3,
    createdAt: date,
  },
  {
    id: 'artist-2',
    name: 'Night Signals',
    slug: null,
    imageUrl: null,
    status: 'draft',
    releaseCount: 0,
    createdAt: date,
  },
];
const labelRows = [
  {
    id: 'label-1',
    name: 'Quiet Signal',
    slug: 'quiet-signal',
    imageUrl: null,
    imageLightUrl: null,
    imageDarkUrl: null,
    status: 'published',
    artistCount: 2,
    releaseCount: 3,
    createdAt: date,
    updatedAt: date,
  },
];
const releaseRows = [
  {
    id: 'release-1',
    title: 'Night Signals',
    slug: 'night-signals',
    type: 'album',
    status: 'published',
    releaseDate: date,
    artworkUrl: null,
  },
  {
    id: 'release-2',
    title: 'First Draft',
    slug: null,
    type: 'ep',
    status: 'draft',
    releaseDate: null,
    artworkUrl: null,
  },
];
export function AdminEntityPagePreview({
  domain = 'artists',
  state = 'ready',
}: {
  domain?: 'artists' | 'labels' | 'releases';
  state?: 'ready' | 'empty' | 'error' | 'create-error';
}) {
  const t = useTranslations('common');
  const [removed, setRemoved] = useState<string[]>([]);
  const [created, setCreated] = useState(false);
  const [tableUrl, setTableUrl] = useState('');
  const params = new URLSearchParams(tableUrl);
  const query = parseTableQuery(params, domain);
  const result = <T extends { id: string }>(rows: T[]) => ({
    ...tableRows(
      state === 'empty' ? [] : rows.filter((row) => !removed.includes(row.id)),
      query,
      (row) =>
        Object.values(row)
          .filter((value) => typeof value === 'string')
          .join(' '),
      (row, key) =>
        Object.entries(row).find(
          ([name]) => name === key || name.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`) === key,
        )?.[1],
    ),
    ...(state === 'error' ? { error: t('messages.failedToLoad') } : {}),
  });
  const title = t(`entities.${domain}`);
  const fields = [
    {
      field: domain === 'releases' ? 'title' : 'name',
      label: t(domain === 'releases' ? 'labels.title' : 'labels.name'),
      type: 'string' as const,
    },
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
    title,
    searchParams: params.toString(),
    searchPlaceholder: t('actions.searchItems', { items: title.toLowerCase() }),
    filterFields: fields,
    sortFields: fields.map(({ field, label }) => ({ field, label })),
  };
  const create = async () =>
    state === 'create-error'
      ? actionFailure(t('messages.failedToLoad'), 'ACTION_FAILED')
      : actionSuccess({ data: { id: 'local-draft' } });
  const remove = (id: string) => setRemoved((current) => [...current, id]);
  return (
    <ServerDataTableNavigationProvider
      value={{
        pathname: `/admin/${domain}`,
        searchParams: params,
        push: (href) => setTableUrl(new URL(href, 'https://preview.invalid').search),
        refresh: () => {},
      }}
    >
      <LayoutContainer size="wide">
        <LayoutStack gap="md">
          {created && <Alert tone="positive">{t('statuses.draft')}</Alert>}
          {domain === 'artists' ? (
            <ArtistsPageView
              {...shared}
              result={result(
                created
                  ? [
                      ...artistRows,
                      {
                        ...artistRows[1],
                        id: 'local-draft',
                        name: t('actions.newItem', { item: t('entities.artist') }),
                      },
                    ]
                  : artistRows,
              )}
              createBindings={{ createAction: create, onCreated: () => setCreated(true) }}
              modalBindings={{
                previewAction: async () =>
                  actionSuccess({
                    data: {
                      revision: 'local-1',
                      totalRelationCount: 3,
                      impacts: [{ domain: 4, entityId: 'release-1', label: 'Night Signals', relationCount: 3 }],
                    },
                  }),
                deleteAction: async (id) => {
                  remove(id);
                  return actionSuccess({ success: true as const });
                },
                onDeleted: () => {},
              }}
            />
          ) : domain === 'labels' ? (
            <LabelsPageView
              {...shared}
              result={result(
                created
                  ? [
                      ...labelRows,
                      {
                        ...labelRows[0],
                        id: 'local-draft',
                        name: t('actions.newItem', { item: t('entities.label') }),
                        status: 'draft',
                      },
                    ]
                  : labelRows,
              )}
              createBindings={{ createAction: create, onCreated: () => setCreated(true) }}
              rowActions={{
                previewAction: async () => ({
                  ok: true,
                  value: {
                    revision: 'local-1',
                    impacts: [],
                    childLabelCount: 0,
                    artistCount: 2,
                    programEventCount: 0,
                    releaseCount: 3,
                  },
                }),
                deleteAction: async (id) => {
                  remove(id);
                  return actionSuccess({ success: true as const });
                },
                onDeleted: () => {},
              }}
            />
          ) : (
            <ReleasesPageView
              {...shared}
              result={result(
                created
                  ? [
                      ...releaseRows,
                      {
                        ...releaseRows[1],
                        id: 'local-release',
                        title: t('actions.newItem', { item: t('entities.release') }),
                      },
                    ]
                  : releaseRows,
              )}
              createBindings={{
                createAction: async () =>
                  state === 'create-error'
                    ? actionFailure(t('messages.failedToLoad'), 'RELEASE_CREATE_FAILED')
                    : actionSuccess({ data: { id: 'local-release' } }),
                onCreated: () => setCreated(true),
              }}
              deleteAction={async (id) => {
                remove(id);
                return actionSuccess({ success: true });
              }}
              modalBindings={{
                deleteAction: async (id) => {
                  remove(id);
                  return actionSuccess({ success: true });
                },
                onDeleted: () => {},
              }}
            />
          )}
        </LayoutStack>
      </LayoutContainer>
    </ServerDataTableNavigationProvider>
  );
}
const meta = {
  title: 'Pages/Admin/Entity Lists',
  excludeStories: ['AdminEntityPagePreview'],
  component: AdminEntityPagePreview,
  args: { domain: 'artists', state: 'ready' },
  render: (args) => <AdminEntityPagePreview key={`${args.domain}-${args.state}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/admin/artists' } },
    docs: {
      description: {
        component:
          'Production ArtistsPageView, LabelsPageView and ReleasesPageView, extracted unchanged from their server route render trees. Actual headers, domain columns, selection, row menus, create controls and deletion controllers run with local typed actions. Create updates a local confirmation; delete removes the actual row. Actual URL search/filter/sort/pagination controllers use the local navigation transport. Text search, scalar eq/neq/contains/in filters, sort and pagination update fixture rows; other operators and server semantics are excluded. Draft editor navigation, permission checks and server shell are outside this adapter.',
      },
    },
  },
} satisfies Meta<typeof AdminEntityPagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Artists: Story = { tags: ['a11y-lists'], play: verifyAdminListControls };
export const ArtistsEmpty: Story = { args: { state: 'empty' } };
export const ArtistsError: Story = { args: { state: 'error' } };
export const ArtistCreateFailed: Story = { args: { state: 'create-error' } };
export const Labels: Story = { tags: ['a11y-lists'], play: verifyAdminListControls, args: { domain: 'labels' } };
export const LabelsEmpty: Story = { args: { domain: 'labels', state: 'empty' } };
export const Releases: Story = { tags: ['a11y-lists'], play: verifyAdminListControls, args: { domain: 'releases' } };
export const ReleasesEmpty: Story = { args: { domain: 'releases', state: 'empty' } };
export const ReleasesError: Story = { args: { domain: 'releases', state: 'error' } };
export const Phone: Story = {
  tags: ['a11y-lists'],
  play: verifyAdminListControls,
  globals: { viewport: { value: 'phone', isRotated: false } },
};
