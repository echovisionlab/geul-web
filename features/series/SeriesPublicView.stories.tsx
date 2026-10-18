import { useTranslations } from 'next-intl';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { SeriesPublicPostsView, SeriesPublicView } from './SeriesPublicView';

const posts = [
  {
    id: 'post-1',
    title: 'Listening to the city after midnight',
    slug: 'listening-to-the-city-after-midnight',
    publishedAt: '2026-07-18T09:00:00Z',
    authors: [{ id: 'member-1', name: 'Mina Park' }],
  },
  {
    id: 'post-2',
    title: 'Field notes from the harbor',
    slug: 'field-notes-from-the-harbor',
    publishedAt: '2026-07-24T09:00:00Z',
    authors: [{ id: 'member-2', name: 'June Han' }],
  },
];

function StoryView({ withImage = false, empty = false }: { withImage?: boolean; empty?: boolean }) {
  const t = useTranslations();
  const featuredImageUrl = withImage
    ? `data:image/svg+xml,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#1f2937"/><circle cx="850" cy="260" r="180" fill="#d97706"/><path d="M0 650 L420 300 L720 650 Z" fill="#374151"/></svg>',
      )}`
    : null;

  return (
    <div style={{ width: 'min(1040px, 94vw)' }}>
      <SeriesPublicView title="Night Walks" featuredImageUrl={featuredImageUrl} postsLabel={t('common.entities.posts')}>
        <SeriesPublicPostsView
          tableLabel="Night Walks"
          posts={empty ? [] : posts}
          labels={{
            title: t('common.labels.title'),
            authors: t('common.labels.authors'),
            published: t('common.labels.published'),
            empty: t('common.messages.noPostsFound'),
            untitled: t('common.states.untitled'),
            unknown: t('common.states.unknown'),
          }}
        />
      </SeriesPublicView>
    </div>
  );
}

const meta = {
  title: 'Feature/Series/Public View',
  component: StoryView,
  tags: ['post-series'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof StoryView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextOnly: Story = {};
export const WithFeaturedImage: Story = { args: { withImage: true } };
export const EmptySeries: Story = { args: { empty: true } };

export const NarrowWithImage: Story = {
  args: { withImage: true },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
