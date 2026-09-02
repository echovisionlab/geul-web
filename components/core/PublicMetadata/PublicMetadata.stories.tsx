import type { Meta, StoryObj } from '@storybook/nextjs';
import { PublicMetadataLink, PublicMetadataRow, PublicMetadataRows, PublicMetadataValueGroup } from './PublicMetadata';

const meta: Meta<typeof PublicMetadataRows> = {
  title: 'Core/DataDisplay/PublicMetadata',
  component: PublicMetadataRows,
  parameters: { layout: 'padded' },
  render: (args) => (
    <PublicMetadataRows {...args}>
      <PublicMetadataRow label="Year">2026</PublicMetadataRow>
      <PublicMetadataRow label="Artists">
        <PublicMetadataValueGroup>
          <PublicMetadataLink href="/artist/one">Artist One</PublicMetadataLink>
          <PublicMetadataLink href="/artist/two">Artist Two</PublicMetadataLink>
        </PublicMetadataValueGroup>
      </PublicMetadataRow>
      <PublicMetadataRow label="Website">
        <PublicMetadataLink href="https://example.com" external>
          example.com
        </PublicMetadataLink>
      </PublicMetadataRow>
    </PublicMetadataRows>
  ),
};

export default meta;
type Story = StoryObj<typeof PublicMetadataRows>;

export const Default: Story = {};
export const Inverse: Story = { args: { tone: 'inverse' }, parameters: { backgrounds: { default: 'dark' } } };
