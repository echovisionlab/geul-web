import type { Meta, StoryObj } from '@storybook/nextjs';
import { useCallback, useRef } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { LayoutContainer } from '@/components/core/Layout';
import { InfiniteItems } from './infinite-items';
import { parseReleaseListProps } from './releases-gallery/schema';
import { ReleaseListViewClient, type ReleaseListViewClientProps } from './releases-gallery/ViewClientRuntime';

type Release = ReleaseListViewClientProps['releases'][number];

const PAGE_SIZE = 6;
const TOTAL = 15;
const release = (index: number): Release => ({
  id: `release-${index}`,
  href: `/releases/release-${index}`,
  title: `Field Notes Vol. ${String(index + 1).padStart(2, '0')}`,
  imageUrl: '/storybook/media/video-poster.jpg',
  imageAlt: `Field Notes Vol. ${index + 1}`,
  releaseDate: '2026-09-12T00:00:00Z',
  mainArtists: [{ id: 'june-han', label: 'June Han', href: '/artists/june-han' }],
});
const pageAt = (offset: number) =>
  Array.from({ length: Math.min(PAGE_SIZE, TOTAL - offset) }, (_, index) => release(offset + index));

function InfiniteReleases({ failFirst = false }: { failFirst?: boolean }) {
  const failed = useRef(false);
  const loadPage = useCallback(
    async (offset: number) => {
      if (failFirst && !failed.current) {
        failed.current = true;
        throw new Error('network');
      }
      return pageAt(offset);
    },
    [failFirst],
  );
  return (
    <LayoutContainer size="wide" inset="md">
      <InfiniteItems initialItems={pageAt(0)} total={TOTAL} loadPage={loadPage}>
        {(releases) => (
          <ReleaseListViewClient
            releases={[...releases]}
            parsedProps={parseReleaseListProps({ layout: 'grid', imageAspectRatio: '1:1' })}
          />
        )}
      </InfiniteItems>
    </LayoutContainer>
  );
}

const meta = {
  title: 'Feature/Page/Infinite Collection',
  component: InfiniteReleases,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A collection block with pagination on: the server renders the first page and nearing the end loads the next one in place. The button is the same action for keyboard and assistive technology, and the retry after a failure. Pages here come from a local function instead of the public API.',
      },
    },
  },
} satisfies Meta<typeof InfiniteReleases>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Nearing the end loads the remaining pages without a click; the button disappears once all are shown. */
export const LoadMore: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Field Notes Vol. 15')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Load more' })).toBeNull();
  },
};

/** A failed page pauses automatic loading; the button retries. */
export const RetryAfterFailure: Story = {
  args: { failFirst: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('alert')).toHaveTextContent("Couldn't load more items.");
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }));
    await expect(await canvas.findByText('Field Notes Vol. 15')).toBeInTheDocument();
  },
};
