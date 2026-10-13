import { useArgs } from 'storybook/preview-api';
import { withFeatureLabels } from '@/stories/feature-localization';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { UrlSectionView } from './UrlSectionView';

const meta = {
  title: 'Feature/Metadata/UrlSectionView',
  component: UrlSectionView,
  render: function InteractiveStory(args) {
    const [, updateArgs] = useArgs();
    return (
      <UrlSectionView
        {...args}
        onChange={(slug) =>
          updateArgs({
            slug,
            error: undefined,
            publicUrlBySlug: slug ? `${new URL(args.publicUrlById).origin}/works/${slug}` : null,
          })
        }
      />
    );
  },
  decorators: [
    withFeatureLabels({
      labels: {
        title: 'common.labels.url',
        description: 'urlSection.description',
        id: 'common.labels.id',
        slug: 'common.labels.slug',
        slugPlaceholder: 'urlSection.placeholders.slug',
        publicUrl: 'urlSection.fields.publicUrl',
        copyId: 'urlSection.actions.copyId',
        copyUrl: 'urlSection.actions.copyUrl',
        copied: 'common.actions.copied',
        openInNewTab: 'common.actions.openInNewTab',
      },
      project: (args, t) => ({ error: args.error ? t('pageEditor.slugValidation.reservedRoute') : args.error }),
    }),
  ],
  args: {
    entityId: 'entity-id',
    slug: 'example',
    isAvailable: true,
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
      copied: 'Copied',
      openInNewTab: 'Open in new tab',
    },
    onChange: () => {},
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

export const WithoutSlug: Story = {
  args: { slug: '', publicUrlBySlug: null },
};

export const Narrow: Story = {
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: {
    publicUrlBySlug: 'https://studio.example.com/works/a-long-public-slug-for-a-narrow-viewport',
  },
};

export const Disabled: Story = {
  args: { disabled: true },
};
