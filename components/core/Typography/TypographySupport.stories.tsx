import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect } from 'storybook/test';
import { LayoutContainer, LayoutStack } from '../Layout';
import { Code, List, Text, VisuallyHidden } from './index';
import { localizedRender, useStorybookText } from '../../../.storybook/fixture-i18n';
function SupportPreview({ ordered = false }: { ordered?: boolean; wrap?: 'preserve' | 'anywhere' }) {
  const text = useStorybookText();
  return (
    <List ordered={ordered} size="sm" spacing="xs">
      <List.Item>{text('Profile')}</List.Item>
      <List.Item>{text('Security')}</List.Item>
      <List.Item>{text('Email preferences')}</List.Item>
    </List>
  );
}
const meta = {
  title: 'Core/Typography/TypographySupport',
  component: SupportPreview,
  args: { ordered: false, wrap: 'preserve' },
  argTypes: { wrap: { control: 'select', options: ['preserve', 'anywhere'] } },
} satisfies Meta<typeof SupportPreview>;
export default meta;
export const Parts: StoryObj<typeof meta> = { render: localizedRender((args) => <SupportPreview {...args} />) };
export const Ordered: StoryObj<typeof meta> = {
  args: { ordered: true },
  render: localizedRender((args) => <SupportPreview {...args} />),
};

const RELEASE_NOTE =
  'Long documents read on one wider measure with more open leading, so a release note that wraps onto a second line stays easy to follow.';
/**
 * `leading="document"`: running text in a document body (changelog release notes) uses the shared
 * `line-height-document` role of published documents and the editor; `interface` pairs leading with size.
 */
export const DocumentLeading: StoryObj<typeof meta> = {
  render: () => (
    <LayoutContainer size="reading" inset="none">
      <LayoutStack gap="xl">
        <List size="sm" data-testid="interface-list">
          <List.Item>{RELEASE_NOTE}</List.Item>
          <List.Item>{RELEASE_NOTE}</List.Item>
        </List>
        <List size="sm" leading="document" data-testid="document-list">
          <List.Item>{RELEASE_NOTE}</List.Item>
          <List.Item>{RELEASE_NOTE}</List.Item>
        </List>
      </LayoutStack>
    </LayoutContainer>
  ),
  play: async ({ canvasElement }) => {
    const ratio = (testId: string) => {
      const style = getComputedStyle(canvasElement.querySelector(`[data-testid="${testId}"]`)!);
      return Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize);
    };
    await expect(ratio('interface-list')).toBeCloseTo(1.45, 2);
    await expect(ratio('document-list')).toBeCloseTo(1.7, 2);
  },
};

export const CodeBlock: StoryObj<typeof meta> = {
  render: ({ wrap }) => (
    <Code block wrap={wrap}>
      const selected = items.filter(item =&gt; item.visible);
    </Code>
  ),
};
export const HiddenLabel: StoryObj<typeof meta> = {
  render: localizedRender(() => (
    <Text>
      Save<VisuallyHidden>Save changes</VisuallyHidden>
    </Text>
  )),
};
