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
