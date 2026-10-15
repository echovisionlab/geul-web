import type { Meta, StoryObj } from '@storybook/nextjs';
import { SiteLogoView } from './SiteLogoView';

const meta: Meta<typeof SiteLogoView> = {
  title: 'Feature/Site/SiteLogo',
  component: SiteLogoView,
  parameters: { layout: 'padded' },
  args: {
    src: '/storybook/media/example-studio-logo.svg',
    alt: 'Example Studio',
    height: 24,
  },
};

export default meta;
type Story = StoryObj<typeof SiteLogoView>;

export const Default: Story = {};

export const Missing: Story = {
  args: {
    src: null,
  },
};

export const MissingXL: Story = {
  args: { src: null, size: 'xl', height: undefined, fallbackText: 'Example Studio' },
};
export const Unconfigured: Story = {
  args: { src: null, size: 'xl', height: undefined, fallbackText: null },
};

export const UnavailableAsset: Story = {
  args: { src: '/storybook/media/unavailable-site-logo.svg', size: 'xl', fallbackText: 'Example Studio' },
};
