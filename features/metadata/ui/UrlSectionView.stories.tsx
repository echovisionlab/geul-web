import type { Meta, StoryObj } from '@storybook/nextjs';

import { UrlSectionView } from './UrlSectionView';

const meta = {
  title: 'Feature/Metadata/UrlSectionView',
  component: UrlSectionView,
  args: {
    entityId: 'entity-id',
    slug: 'example',
    publicUrlById: 'https://studio.example.com/works/entity-id',
    publicUrlBySlug: 'https://studio.example.com/works/example',
    labels: {
      title: 'URL',
      description: 'Public URL settings',
      id: 'ID',
      slug: 'Slug',
      slugPlaceholder: 'slug',
      publicUrl: 'Public URL',
      copyId: 'Copy ID',
      copyUrl: 'Copy URL',
      openInNewTab: 'Open in new tab',
      autoModeEnabled: 'Automatic slug enabled',
      autoModeManual: 'Manual slug',
    },
    onChange: () => {},
    onCopyId: () => {},
    onCopyUrl: () => {},
  },
} satisfies Meta<typeof UrlSectionView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ReservedPageRouteError: Story = {
  args: {
    slug: 'admin/team',
    publicUrlBySlug: null,
    error: 'This path is reserved by the site. Choose a different first segment.',
  },
};
