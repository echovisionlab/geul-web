import type { Meta, StoryObj } from '@storybook/nextjs';
import { PrintHeaderView } from './PrintHeaderView';

const meta: Meta<typeof PrintHeaderView> = {
  title: 'Feature/Shell/PrintHeader',
  component: PrintHeaderView,
  parameters: { layout: 'padded' },
  args: {
    logoSrc: '/storybook/media/example-studio-logo.svg',
    logoAlt: 'Example Studio',
    companyName: 'Example Studio',
    taxId: '123-45-67890',
  },
};

export default meta;
type Story = StoryObj<typeof PrintHeaderView>;

export const Default: Story = {};

export const WithoutLogoOrTaxId: Story = {
  args: {
    logoSrc: null,
    taxId: null,
  },
};
