import type { Meta, StoryObj } from '@storybook/nextjs';
import { ListBlockSkeleton } from './ListBlockSkeleton';
import { AuthorListSkeleton } from './author-list/Skeleton';
import { PostMapSkeleton } from './post-map/Skeleton';
import { TableLoadingFallback } from './TableLoadingFallback';

const meta = {
  title: 'Feature/Page/Block Loading',
  component: ListBlockSkeleton,
  args: { className: 'post-list-block', columns: 3, limit: 6, layout: 'grid' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ListBlockSkeleton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Grid: Story = {};
export const List: Story = { args: { layout: 'list', showImage: false } };
export const Authors: Story = { render: () => <AuthorListSkeleton /> };
export const Map: Story = { render: () => <PostMapSkeleton /> };
export const Table: Story = { render: () => <TableLoadingFallback reservedRowCount={10} /> };
