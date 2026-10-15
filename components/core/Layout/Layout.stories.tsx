import { Text as DsText } from '@/components/core/Typography';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from '../Button';
import { TextInput, Select } from '../Input';
import { SectionCard } from '../Section';
import { primitiveTokens } from '../design-tokens';
import {
  LayoutContainer,
  LayoutGrid,
  LayoutGridItem,
  LayoutInline,
  LayoutInset,
  LayoutSpacer,
  LayoutStack,
  type LayoutColumnCount,
  type LayoutStackProps,
  type Space,
} from './index';

const spaces: Space[] = ['none', ...(Object.keys(primitiveTokens.spacing) as Exclude<Space, 'none'>[])];
const meta = {
  title: 'Core/Layout/Primitives',
  component: LayoutStack,
  parameters: { layout: 'padded' },
  args: { gap: 'md', align: 'stretch' },
  argTypes: {
    gap: { control: 'select', options: spaces },
    align: { control: 'select', options: ['start', 'center', 'end', 'stretch'] },
  },
} satisfies Meta<typeof LayoutStack>;
export default meta;
type Story = StoryObj<typeof meta>;

function Samples({ count = 3 }: { count?: number }) {
  const t = useTranslations('common');
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <SectionCard key={index} padding="sm">
          <DsText size="sm">
            {t('labels.content')} {index + 1}
          </DsText>
        </SectionCard>
      ))}
    </>
  );
}

function StackPreview(args: LayoutStackProps) {
  return (
    <LayoutStack {...args}>
      <Samples />
    </LayoutStack>
  );
}
export const Stack: Story = { render: (args) => <StackPreview {...args} /> };

function InlinePreview(args: LayoutStackProps) {
  const t = useTranslations('common');
  return (
    <LayoutInline gap={args.gap} align={args.align} wrap="wrap">
      <DsText size="sm">{t('actions.add')}</DsText>
      <DsText size="sm">{t('actions.cancel')}</DsText>
      <LayoutSpacer axis="inline" size="sm" flexible />
      <DsText size="sm">{t('labels.preview')}</DsText>
    </LayoutInline>
  );
}
export const Inline: Story = { render: (args) => <InlinePreview {...args} /> };

export const Inset: Story = {
  render: (args) => (
    <SectionCard padding="none">
      <LayoutInset space={args.gap} inline={{ md: 'xl' }}>
        <LayoutStack gap="xxs">
          <Samples />
        </LayoutStack>
      </LayoutInset>
    </SectionCard>
  ),
};
export const Container: Story = {
  render: () => (
    <LayoutContainer size="compact" inset={{ base: 'sm', md: 'lg' }}>
      <Samples count={1} />
    </LayoutContainer>
  ),
};
export const ResponsiveGrid: Story = {
  render: () => (
    <LayoutGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={{ base: 'sm', md: 'lg' }} align="stretch">
      <Samples count={6} />
    </LayoutGrid>
  ),
};
export const EventColumns: Story = {
  render: () => (
    <LayoutGrid columns={12} gap="xl">
      <LayoutGridItem span={{ base: 12, md: 7 }}>
        <Samples count={1} />
      </LayoutGridItem>
      <LayoutGridItem span={{ base: 12, md: 5 }}>
        <Samples count={1} />
      </LayoutGridItem>
    </LayoutGrid>
  ),
};

function InteractiveLayout() {
  const t = useTranslations('common');
  const tLayout = useTranslations('pageEditor.blockEditor');
  const [gap, setGap] = useState<Space>('md');
  const [columns, setColumns] = useState<LayoutColumnCount>(3);
  const [count, setCount] = useState(3);
  const [draft, setDraft] = useState('Layout');
  return (
    <LayoutContainer size="wide" inset="none">
      <LayoutStack gap="lg">
        <LayoutGrid columns={{ base: 1, sm: 3 }} gap="md" align="end">
          <TextInput
            label={t('labels.name')}
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            data-testid="layout-draft"
          />
          <Select
            label={tLayout('labels.gap')}
            value={gap}
            data={spaces}
            allowDeselect={false}
            onChange={(value) => setGap(value as Space)}
            data-testid="layout-space"
          />
          <Select
            label={tLayout('labels.columns')}
            value={String(columns)}
            data={['1', '2', '3', '4']}
            allowDeselect={false}
            onChange={(value) => setColumns(Number(value) as LayoutColumnCount)}
            data-testid="layout-columns"
          />
        </LayoutGrid>
        <LayoutInline justify="between" gap="sm">
          <DsText size="sm">{t('labels.preview')}</DsText>
          <Button onClick={() => setCount((value) => value + 1)} data-testid="layout-add">
            {t('actions.add')}
          </Button>
        </LayoutInline>
        <LayoutGrid columns={columns} gap={gap} align="stretch" data-testid="layout-preview">
          {Array.from({ length: count }, (_, index) => (
            <SectionCard key={index} padding="sm" data-testid="layout-cell">
              <LayoutStack gap="xxs">
                <DsText size="sm">
                  {draft} {index + 1}
                </DsText>
                <DsText size="xs" tone="secondary">
                  {t('labels.content')}
                </DsText>
              </LayoutStack>
            </SectionCard>
          ))}
        </LayoutGrid>
      </LayoutStack>
    </LayoutContainer>
  );
}
export const Interactive: Story = {
  render: () => <InteractiveLayout />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.clear(canvas.getByTestId('layout-draft'));
    await userEvent.type(canvas.getByTestId('layout-draft'), 'Studio');
    await userEvent.click(canvas.getByTestId('layout-add'));
    await expect(canvas.getAllByTestId('layout-cell')).toHaveLength(4);
    await expect(canvas.getByTestId('layout-draft')).toHaveValue('Studio');
    await expect(canvas.getAllByTestId('layout-cell')[0]).toHaveTextContent('Studio 1');
  },
};

export const FormContainer: Story = {
  render: () => (
    <LayoutContainer size="form" inset="sm">
      <LayoutStack gap="md">
        <TextInput label="Email" type="email" />
      </LayoutStack>
    </LayoutContainer>
  ),
};
