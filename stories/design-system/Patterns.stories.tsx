import type { Meta, StoryObj } from '@storybook/nextjs';
import { useLocale } from 'next-intl';
import { LayoutContainer, LayoutStack } from '@/components/core/Layout';
import { SectionCard } from '@/components/core/Section';
import { Heading, Text } from '@/components/core/Typography';
import { CollectionFormPreview, TableCompositionPreview } from '../shared/CompositionPreviews';
import { InputPreview } from '../shared/ControlPreviews';
import type { PreviewState } from '../shared/PreviewFrame';
import { StorybookLink } from '../shared/StorybookLink';

const patterns = {
  form: {
    title: 'Input → validate → save',
    purpose: 'Use when several fields submit one change.',
    contract: [
      'Field owns label, help and error relationships. Input owns value, interaction and availability.',
      'Associate validation errors with their inputs. Block duplicate saves and announce progress.',
      'Cancel and save share action-row sizing and use the standard command emphasis.',
      'This is a Core composition. Page contracts define authorization and persistence boundaries.',
    ],
    links: [
      ['Default and validation', 'composition-form--playground'],
      ['Saving', 'composition-form--pending'],
      ['Failure', 'composition-form--error'],
      ['Public form page contract', 'design-system-pages--public-form'],
    ],
  },
  collection: {
    title: 'Find → sort → select → act',
    purpose: 'Use for searchable collections, selection and row or bulk actions.',
    contract: [
      'Toolbar owns arrangement and density. DataTable owns rows, selection and sorting structure.',
      'Keep empty results, loading and read failures distinct.',
      'Inspect columns and actions at narrow widths. Provide an accessible path to any collapsed action.',
      'Row action names identify their targets. Destructive actions use the shared confirmation dialog.',
    ],
    links: [
      ['Collection', 'composition-data-table--playground'],
      ['Empty collection', 'composition-data-table--empty'],
      ['Loading', 'composition-data-table--pending'],
      ['Read failure', 'composition-data-table--error'],
      ['Mobile', 'composition-data-table--phone'],
      ['Admin content page contract', 'design-system-pages--admin-content'],
    ],
  },
  input: {
    title: 'Combine input and selection',
    purpose: 'Review text, number, select and choice controls in one form.',
    contract: [
      'Use the shared label, description, error and required contracts with the appropriate Core control.',
      'Read-only preserves access to the value. Disabled prevents interaction. Keep those states distinct.',
      'Inspect column widths and wrapping with long translations, help and errors.',
      'Check keyboard order, IME input, group names and value changes in the running example.',
    ],
    links: [
      ['Default', 'composition-input-controls--playground'],
      ['Invalid', 'composition-input-controls--error'],
      ['Disabled', 'composition-input-controls--disabled'],
      ['Public form page contract', 'design-system-pages--public-form'],
    ],
  },
} as const;

export function PatternDocumentation({ pattern, state }: { pattern: keyof typeof patterns; state: PreviewState }) {
  const locale = useLocale();
  const selected = patterns[pattern];
  return (
    <LayoutContainer as="section" size="wide" inset="lg" lang="en">
      <LayoutStack gap="lg">
        <LayoutStack gap="xs">
          <Heading level={1} scale={3}>{`Patterns · ${selected.title}`}</Heading>
          <Text size="sm" tone="secondary">
            {selected.purpose}
          </Text>
        </LayoutStack>
        <SectionCard>
          <LayoutStack gap="sm">
            <Heading level={2} scale={4}>
              Usage contract
            </Heading>
            {selected.contract.map((item) => (
              <Text key={item} size="sm">
                {item}
              </Text>
            ))}
            {selected.links.map(([name, id]) => (
              <StorybookLink key={id} href={`/?path=/story/${id}`}>
                {name}
              </StorybookLink>
            ))}
          </LayoutStack>
        </SectionCard>
        <Heading level={2} scale={4}>
          Running example
        </Heading>
        <Text size="sm" tone="secondary">
          Documentation stays in English. The fixture uses the toolbar locale and active theme. Local state changes do
          not establish service, authorization or assistive technology results.
        </Text>
        <LayoutStack lang={locale} gap="md">
          {pattern === 'form' ? <CollectionFormPreview state={state} /> : null}
          {pattern === 'collection' ? <TableCompositionPreview state={state} /> : null}
          {pattern === 'input' ? <InputPreview state={state} /> : null}
        </LayoutStack>
      </LayoutStack>
    </LayoutContainer>
  );
}

const meta = {
  title: 'Design System/Patterns',
  component: PatternDocumentation,
  excludeStories: ['PatternDocumentation'],
  args: { pattern: 'form', state: 'ready' },
  argTypes: {
    pattern: { control: 'select', options: ['form', 'collection', 'input'] },
    state: { control: 'select', options: ['ready', 'pending', 'error', 'disabled'] },
  },
  parameters: { canvasInset: 'none' },
} satisfies Meta<typeof PatternDocumentation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Form: Story = {};
export const Collection: Story = { args: { pattern: 'collection' } };
export const Inputs: Story = { args: { pattern: 'input' } };
