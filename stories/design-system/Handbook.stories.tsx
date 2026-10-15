import type { Meta, StoryObj } from '@storybook/nextjs';
import { Handbook } from './Handbook';

const meta = {
  title: 'Design System/Handbook',
  component: Handbook,
  args: { initialDocument: 'docs/design-system.md' },
  parameters: { canvasInset: 'none', controls: { disable: true } },
} satisfies Meta<typeof Handbook>;
export default meta;
type Story = StoryObj<typeof meta>;
export const GettingStarted: Story = { args: { initialDocument: 'docs/design-system/getting-started.md' } };
export const Contribution: Story = { args: { initialDocument: 'docs/design-system/contribution.md' } };
export const Changelog: Story = { args: { initialDocument: 'docs/design-system/changelog.md' } };
export const Reference: Story = {};
export const CoreSpecification: Story = { args: { initialDocument: 'docs/design-system/core-specifications.md' } };
export const SpacingAndIcons: Story = { args: { initialDocument: 'docs/design-system/spacing-icon-contract.md' } };
export const AccessibilityReview: Story = { args: { initialDocument: 'docs/design-system/review.md' } };
