import { NativeRange } from './NativeRange';
import { PinInput } from './PinInput';
import {
  Checkbox,
  DateInput,
  DateRangeInput,
  DateTimePicker,
  FileInput,
  MultiSelect,
  NumberInput,
  PasswordInput,
  Select,
  TextInput,
  TimePicker,
} from './index';
import type { TextInputProps } from './TextInput';

export const supported = (
  <>
    <TextInput
      label="Name"
      size="sm"
      density="compact"
      grow
      value="draft"
      onChange={(event) => event.currentTarget.value}
      data-view="profile"
    />
    <Checkbox size="xs" density="compact" checked onChange={(event) => event.currentTarget.checked} />
    <NumberInput value={3} min={0} max={10} onChange={(value) => String(value)} />
    <PasswordInput label="Password" readOnly visible onVisibilityChange={(visible) => String(visible)} />
    <Select data={[{ value: '1', label: 'One' }]} onChange={(value, option) => [value, option.label]} />
    <MultiSelect data={['one']} value={['one']} withPillsReorder />
    <DateInput value="2026-10-10" onChange={(value) => value?.slice(0, 10)} />
    <DateTimePicker value="2026-10-10 12:34:00" />
    <DateRangeInput value={['2026-10-10', null]} onChange={([start, end]) => [start, end]} />
    <TimePicker value="01:02:03" withSeconds />
    <FileInput multiple onChange={(files) => files?.map((file) => file.name)} />
  </>
);
// @ts-expect-error Presentation is owned by Core, including supported upstream props.
export const rawStyle = <TextInput style={{ color: 'red' }} />;
// @ts-expect-error PasswordInput owns the visibility accessory rather than silently discarding a public slot.
export const passwordAccessory = <PasswordInput label="Password" rightSection="Custom action" />;
// @ts-expect-error Slot overrides cannot bypass Core input state styling.
export const slotStyle = <Select styles={{ input: { border: 0 } }} />;
// @ts-expect-error Foreign class callbacks cannot replace mandatory keyboard focus.
export const classes = <TextInput classNames={() => ({ input: 'other' })} />;
// @ts-expect-error Geometry is provided by a layout owner rather than input props.
export const width = <NumberInput w={120} />;
// @ts-expect-error Sizes are a closed shared scale.
export const numericSize = <TextInput size={42} />;
// @ts-expect-error Density is a closed shared variant.
export const foreignDensity = <Select density="tiny" />;
// @ts-expect-error Reserved Core markers reject even a typed spread.
export const reserved: TextInputProps = { 'data-geul-input-size': 'xl' };
// @ts-expect-error Vendor skin variants are not a presentation API.
export const variant = <TextInput variant="unstyled" />;
// @ts-expect-error Domain dates do not admit upstream style/portal objects.
export const dateEscape = <DateInput popoverProps={{ withinPortal: false }} />;
// @ts-expect-error Internal primitive overrides are not exposed.
export const unstyled = <TimePicker unstyled />;

// @ts-expect-error Legacy Core markers are reserved and cannot change implementation state.
export const legacyReserved: TextInputProps = { 'data-core-input-size': 'xl' };

const colorOverride = { value: 'Draft', c: 'red' };
// @ts-expect-error Variable spreads cannot reopen the shared color authority.
export const variableColor = <TextInput {...colorOverride} />;
const layoutOverride = { value: 1, px: 16 };
// @ts-expect-error Variable spreads cannot inject private input spacing.
export const variableSpacing = <NumberInput {...layoutOverride} />;
const rootOverride = { value: 'draft', component: 'textarea' };
// @ts-expect-error Variable spreads cannot substitute a primitive implementation.
export const variableRoot = <TextInput {...rootOverride} />;

export const fieldEscape: import('../Field/Field').FieldProps = {
  label: 'Name',
  children: null,
  // @ts-expect-error Closed Field rejects presentation hidden in a variable.
  style: { color: 'red' },
};
export const searchEscape: Partial<import('./SearchComboboxView').SearchComboboxViewProps<string>> = {
  // @ts-expect-error Search views expose no foreign input slot styling.
  styles: { input: {} },
};

// @ts-expect-error Checkbox size uses the same closed scale as the other inputs.
export const checkboxSize = <Checkbox size="tiny" />;
// @ts-expect-error A consumer cannot replace the Core checkbox mark or state styling.
export const checkboxSkin = <Checkbox className="other" />;

// @ts-expect-error Native range sizing is owned by Core.
const styledRange = <NativeRange label="Columns" value={0} onChange={() => {}} style={{ width: 300 }} />;
void styledRange;

export const contentWidthSelect = <Select width="content" data={['Author', 'Collaborator']} />;
// @ts-expect-error Content fitting does not reopen arbitrary width geometry.
export const arbitrarySelectWidth = <Select width="180px" />;

export const centeredPin = <PinInput align="center" length={6} />;
// @ts-expect-error PIN alignment is a closed Core contract.
export const arbitraryPinAlignment = <PinInput align="left" />;
