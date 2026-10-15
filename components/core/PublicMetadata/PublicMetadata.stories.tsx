import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { PublicMetadataLink, PublicMetadataRow, PublicMetadataRows, PublicMetadataValueGroup } from './PublicMetadata';
import { ImageChrome } from '../Typography';
import { MediaImage } from '../MediaImage';

const meta: Meta<typeof PublicMetadataRows> = {
  title: 'Core/Data Display/PublicMetadata',
  component: PublicMetadataRows,
  parameters: { layout: 'padded' },
  render: localizedRender((args) => (
    <PublicMetadataRows {...args}>
      <PublicMetadataRow label="Year">2026</PublicMetadataRow>
      <PublicMetadataRow label="Artists">
        <PublicMetadataValueGroup>
          <PublicMetadataLink href="/artist/one">Artist One</PublicMetadataLink>
          <PublicMetadataLink href="/artist/two">Artist Two</PublicMetadataLink>
        </PublicMetadataValueGroup>
      </PublicMetadataRow>
      <PublicMetadataRow label="Tags">
        <PublicMetadataValueGroup separator="slash">
          <PublicMetadataLink href="/tag/field-recording">Field recording</PublicMetadataLink>
          <PublicMetadataLink href="/tag/long-form-observations">Long-form observations</PublicMetadataLink>
        </PublicMetadataValueGroup>
      </PublicMetadataRow>
      <PublicMetadataRow label="Website">
        <PublicMetadataLink href="https://example.com" external indicator="external">
          example.com
        </PublicMetadataLink>
      </PublicMetadataRow>
    </PublicMetadataRows>
  )),
};

export default meta;
type Story = StoryObj<typeof PublicMetadataRows>;

export const Default: Story = {};
export const Inverse: Story = {
  args: { tone: 'inverse' },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 420, maxWidth: '100%', height: 320 }}>
        <MediaImage src="/storybook/media/video-poster.jpg" alt="" fill fit="cover" />
        <ImageChrome placement="cover" shade="header" inset="md">
          <Story />
        </ImageChrome>
      </div>
    ),
  ],
};
