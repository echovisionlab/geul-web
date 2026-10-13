import type { Meta, StoryObj } from '@storybook/nextjs';
import { LayoutContainer } from '@/components/core/Layout';
import { ChangelogPageView } from '@/features/changelog/ChangelogPageView';
import { SitemapPageView } from '@/features/navigation/SitemapPageView';
import type { ChangelogRelease } from '@/lib/changelog/changelog';
import { PublicShellStoryHarness } from '@/stories/public/fixtures/PublicShellStoryHarness';

const releases: ChangelogRelease[] = [
  {
    version: '0.11.2',
    url: null,
    date: '2026-10-10',
    groups: [
      {
        title: 'Changes',
        items: [
          {
            rawText: 'Shared controls',
            parts: [{ type: 'text', text: 'Shared editor controls and keyboard navigation.' }],
          },
        ],
      },
      {
        title: 'Fixes',
        items: [
          {
            rawText: 'Rendering',
            parts: [
              { type: 'text', text: 'Mermaid rendering uses the current theme. ' },
              { type: 'link', text: 'Release notes', href: 'https://github.com/echovisionlab/geul-web/releases' },
            ],
          },
        ],
      },
    ],
  },
];
const longReleases: ChangelogRelease[] = Array.from({ length: 6 }, (_, index) => ({
  version: `0.${11 - index}.0`,
  url: null,
  date: `2026-${String(10 - index).padStart(2, '0')}-01`,
  groups: ['Features', 'Changes', 'Fixes'].map((title) => ({
    title,
    items: Array.from({ length: 4 }, (_, item) => ({
      rawText: `${title} ${item}`,
      parts: [
        {
          type: 'text' as const,
          text: 'Shared editor controls, keyboard navigation and the public reading layout were refined across documents. ',
        },
      ],
    })),
  })),
}));
function PublicUtilityPreview({
  page = 'sitemap',
  empty = false,
  long = false,
}: {
  page?: 'sitemap' | 'changelog';
  empty?: boolean;
  long?: boolean;
}) {
  if (long) {
    // Production frame: the route renders directly in the site shell's main region.
    return (
      <PublicShellStoryHarness initialPath="/changelog">
        <ChangelogPageView releases={longReleases} />
      </PublicShellStoryHarness>
    );
  }
  return (
    <LayoutContainer size="wide" inset="md">
      {page === 'sitemap' ? <SitemapPageView /> : <ChangelogPageView releases={empty ? [] : releases} />}
    </LayoutContainer>
  );
}
const meta = {
  title: 'Pages/Public/Utilities',
  component: PublicUtilityPreview,
  args: { page: 'sitemap', empty: false },
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Actual production SitemapPageView and ChangelogPageView. Changelog authorization and filesystem loading remain in the server route; preview uses authored local release data. Core navigation, typography, list and layout own presentation.',
      },
    },
  },
} satisfies Meta<typeof PublicUtilityPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Sitemap: Story = {};
export const SitemapPhone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
export const Changelog: Story = { args: { page: 'changelog' } };
export const ChangelogEmpty: Story = { args: { page: 'changelog', empty: true } };
/** Many releases in the production site shell: outline column, rail and reading measure. */
export const ChangelogLongDocument: Story = { args: { page: 'changelog', long: true } };
