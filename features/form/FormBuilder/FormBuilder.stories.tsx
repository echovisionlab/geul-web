import type { Meta, StoryObj } from '@storybook/nextjs';
import { useTranslations } from 'next-intl';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { FormBuilder } from './FormBuilder';
import type { FormSchema } from '@/lib/types/form/schema';

function BuilderPreview({
  mode,
  scenario = 'simple',
}: {
  mode: 'full' | 'translation' | 'readOnly';
  scenario?: 'simple' | 'configuration' | 'large';
}) {
  const t = useTranslations('common.labels');
  const tCommon = useTranslations('common');
  const tBuilder = useTranslations('formAdmin.builder');
  const configuration: FormSchema = {
    id: 'storybook-builder-configuration',
    steps: [
      {
        id: 'contact-details',
        title: t('title'),
        fields: [
          {
            id: 'name-field',
            key: 'name',
            type: 'text',
            label: t('name'),
            validation: {
              validators: [
                { id: 'required-rule', name: 'Required', predicate: 'required' },
                { id: 'length-rule', name: 'Minimum length', predicate: 'gte', value: 2 },
              ],
            },
          },
          {
            id: 'format-field',
            key: 'format',
            type: 'select',
            label: t('type'),
            options: [
              { id: 'studio', label: 'Studio', value: 'studio' },
              { id: 'live', label: 'Live', value: 'live' },
            ],
            condition: { fieldId: 'name-field', operator: 'exists' },
          },
          { id: 'date-field', key: 'date', type: 'date', label: tBuilder('fieldTypes.date'), minDate: '2026-10-10' },
        ],
      },
    ],
  };
  return (
    <FormBuilder
      mode={mode}
      title={tCommon('entities.form')}
      initialSchema={
        scenario === 'large'
          ? {
              id: 'storybook-large-builder',
              steps: Array.from({ length: 2 }, (_, stepIndex) => ({
                id: `step-${stepIndex}`,
                title: `${tBuilder('defaults.newStepTitle')} ${stepIndex + 1}`,
                fields: Array.from({ length: 12 }, (_, fieldIndex) => ({
                  id: `field-${stepIndex}-${fieldIndex}`,
                  key: `field_${stepIndex}_${fieldIndex}`,
                  type: 'text' as const,
                  label: `${t('name')} ${stepIndex + 1}.${fieldIndex + 1}`,
                })),
              })),
            }
          : scenario === 'configuration'
            ? configuration
            : {
                id: 'storybook-builder',
                steps: [
                  {
                    id: 'details',
                    title: t('title'),
                    fields: [{ id: 'name', key: 'name', type: 'text', label: t('name') }],
                  },
                ],
              }
      }
    />
  );
}

const meta = {
  title: 'Feature/Form/Builder',
  component: BuilderPreview,
  parameters: { layout: 'fullscreen' },
  args: { mode: 'full' },
} satisfies Meta<typeof BuilderPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EditingThenPreview: Story = {};
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
export const Translation: Story = { args: { mode: 'translation' } };
export const ReadOnly: Story = { args: { mode: 'readOnly' } };
export const Configuration: Story = { args: { scenario: 'configuration' } };

export const LargeFormReorder: Story = {
  args: { scenario: 'large' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const handles = canvas
      .getAllByRole('button')
      .filter((button) => button.getAttribute('data-interaction') === 'drag-handle');
    await expect(handles).toHaveLength(2);
    const first = handles[0];
    await userEvent.click(first);
    await userEvent.keyboard(' {ArrowDown} ');
    // Dnd Kit restores keyboard focus on the next animation frame after drop.
    // Retain the same item/node assertion so detached or remounted handles fail.
    await waitFor(async () => {
      const reordered = canvas
        .getAllByRole('button')
        .filter((button) => button.getAttribute('data-interaction') === 'drag-handle');
      await expect(reordered[1]).toBe(first);
      await expect(first).toBeInTheDocument();
      await expect(first).toHaveFocus();
    });
  },
};
