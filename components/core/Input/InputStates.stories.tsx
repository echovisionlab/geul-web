import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useTranslations } from 'next-intl';
import { expect, userEvent, within } from 'storybook/test';
import { localizedRender } from '@/.storybook/fixture-i18n';
import { LayoutGrid, LayoutStack } from '../Layout';
import { TextInput } from './TextInput';
import { PasswordInput } from './PasswordInput';
import { NativeSelect } from './NativeSelect';
import { Select } from './Select';
import { MultiSelect } from './MultiSelect';
import { Textarea } from './Textarea';
import { DateInput, DateRangeInput, DateTimePicker, MonthPickerInput, TimePicker } from './DateInputs';
import type { InputDensity, InputSize } from './input-contract';
interface ContractPreviewProps {
  size: InputSize;
  density: InputDensity;
  disabled: boolean;
  readOnly: boolean;
  invalid: boolean;
  animate: boolean;
}
function ContractPreview(props: ContractPreviewProps) {
  const t = useTranslations('common.labels');
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>('2026-10-10');
  const state = {
    size: props.size,
    density: props.density,
    disabled: props.disabled,
    readOnly: props.readOnly,
    error: props.invalid ? t('error') : undefined,
    animate: props.animate,
  };
  const options = [
    { value: 'name', label: t('name') },
    { value: 'email', label: t('email') },
    { value: 'language', label: t('language') },
  ];
  return (
    <LayoutGrid columns={{ base: 1, md: 2 }} gap="lg" align="start">
      <LayoutStack gap="md">
        <TextInput
          {...state}
          label={t('name')}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
        />
        <PasswordInput {...state} label={t('password')} />
        <Textarea {...state} label={t('description')} autosize minRows={2} maxRows={5} />
        <NativeSelect {...state} label={t('language')} data={options} />
        <Select
          {...state}
          label={t('options')}
          data={options}
          value={selected}
          onChange={setSelected}
          searchable
          clearable
        />
        <MultiSelect
          {...state}
          label={t('tags')}
          data={options}
          value={tags}
          onChange={setTags}
          searchable
          withPillsReorder
        />
      </LayoutStack>
      <LayoutStack gap="md">
        <DateInput {...state} label={t('created')} value={date} onChange={setDate} clearable />
        <DateTimePicker {...state} label={t('published')} defaultValue="2026-10-10 12:30:00" clearable />
        <DateRangeInput {...state} label={t('created')} defaultValue={['2026-10-10', '2026-10-12']} clearable />
        <MonthPickerInput {...state} label={t('updated')} defaultValue="2026-10-01" clearable />
        <TimePicker {...state} label={t('length')} defaultValue="01:02:03" withSeconds clearable />
      </LayoutStack>
    </LayoutGrid>
  );
}
const meta = {
  title: 'Core/Input/Input States',
  component: ContractPreview,
  parameters: { canvasInset: 'none', layout: 'padded' },
  args: { size: 'sm', density: 'comfortable', disabled: false, readOnly: false, invalid: false, animate: true },
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    density: { control: 'select', options: ['comfortable', 'compact'] },
  },
} satisfies Meta<typeof ContractPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const StateMatrix: Story = {};
export const StaticFocus: Story = { args: { animate: false } };
export const Invalid: Story = { args: { invalid: true } };
export const Compact: Story = { args: { density: 'compact' } };

export const NarrowDateRange: Story = {
  render: localizedRender(() => (
    <div style={{ width: 220, maxWidth: '100%' }}>
      <DateRangeInput label="Date range" defaultValue={['2026-10-10', '2026-10-12']} clearable />
    </div>
  )),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const targets = [...canvas.getAllByRole('spinbutton'), ...canvas.getAllByRole('button')];
    const wrapper = canvasElement.querySelector('[role="group"]')!;
    const fieldBounds = wrapper.getBoundingClientRect();
    const rectangles = targets.map((target) => target.getBoundingClientRect());
    for (const rect of rectangles) {
      await expect(rect.width).toBeGreaterThanOrEqual(24);
      await expect(rect.height).toBeGreaterThanOrEqual(24);
      await expect(rect.left).toBeGreaterThanOrEqual(fieldBounds.left - 1);
      await expect(rect.right).toBeLessThanOrEqual(fieldBounds.right + 1);
    }
    for (let index = 0; index < rectangles.length; index += 1) {
      for (const other of rectangles.slice(index + 1)) {
        const rect = rectangles[index];
        const overlap =
          Math.min(rect.right, other.right) > Math.max(rect.left, other.left) &&
          Math.min(rect.bottom, other.bottom) > Math.max(rect.top, other.top);
        await expect(overlap).toBe(false);
      }
    }
  },
};

export const IntrinsicDateRange: Story = {
  render: localizedRender(() => (
    <div style={{ width: 420, maxWidth: '100%' }}>
      <DateRangeInput label="Date range" defaultValue={['2026-10-10', '2026-10-12']} />
    </div>
  )),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const segments = canvas.getAllByRole('spinbutton');
    const [start, end] = segments
      .filter((segment) => segment.getAttribute('data-type') === 'year')
      .map((segment) => segment.parentElement!.getBoundingClientRect());
    await expect(Math.abs(start.top - end.top)).toBeLessThanOrEqual(1);
    await expect(end.left - start.right).toBeGreaterThan(0);
    await expect(end.left - start.right).toBeLessThanOrEqual(24);

    const month = segments.find((segment) => segment.getAttribute('data-type') === 'month')!;
    await userEvent.click(month);
    const style = canvasElement.ownerDocument.defaultView!.getComputedStyle(month);
    await expect(month).toHaveFocus();
    await expect(style.outlineStyle).toBe('none');
    await expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    await expect(style.textDecorationLine).toContain('underline');
    await userEvent.keyboard('{ArrowUp}');
    await expect(month).toHaveAttribute('aria-valuenow', '11');
    await expect(canvasElement.ownerDocument.defaultView!.getComputedStyle(month).textDecorationLine).toContain(
      'underline',
    );
  },
};
