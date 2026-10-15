import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { SectionCard } from './SectionCard';
const meta: Meta<typeof SectionCard> = {
  title: 'Core/Layout/SectionCard',
  component: SectionCard,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ width: 'min(640px, 94vw)' }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof SectionCard>;
export const SectionCardBasic: Story = {
  render: localizedRender(() => (
    <SectionCard>
      <DsLayoutStack gap="xxs">
        <DsText weight="strong">Section title</DsText>
        <DsText size="sm" tone="secondary">
          Section cards frame related controls without adding domain behavior.
        </DsText>
      </DsLayoutStack>
    </SectionCard>
  )),
};

export const ExplicitBoundary: Story = {
  render: localizedRender(() => (
    <SectionCard withBorder>
      <DsText size="sm">A bounded workspace when its edge carries meaning.</DsText>
    </SectionCard>
  )),
};

export const ResponsiveInset: Story = {
  render: localizedRender(() => (
    <SectionCard padding={{ base: 'none', sm: 'md' }}>
      <DsText size="sm">Shared content track on mobile, panel inset on wider screens.</DsText>
    </SectionCard>
  )),
  globals: { viewport: { value: 'phone', isRotated: false } },
};
export const GroupedWithoutBorders: Story = {
  render: localizedRender(() => (
    <DsLayoutStack gap="xl">
      <SectionCard appearance="plain" padding="none">
        <DsLayoutStack gap="xs">
          <DsText weight="strong">Account details</DsText>
          <DsText size="sm">A section is identified by its label and spacing.</DsText>
        </DsLayoutStack>
      </SectionCard>
      <SectionCard appearance="plain" padding="none">
        <DsLayoutStack gap="xs">
          <DsText weight="strong">Active sessions</DsText>
          <DsText size="sm">Repeated content follows the same alignment.</DsText>
        </DsLayoutStack>
      </SectionCard>
    </DsLayoutStack>
  )),
};

export const DockedAndPaper: Story = {
  render: localizedRender(() => (
    <DsLayoutStack gap="sm">
      <SectionCard border="block" padding="xs">
        <DsText>Project details</DsText>
      </SectionCard>
      <SectionCard appearance="paper" withBorder clip>
        <DsText tone="inherit">Document preview</DsText>
      </SectionCard>
    </DsLayoutStack>
  )),
};
