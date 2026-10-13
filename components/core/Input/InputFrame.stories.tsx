import type { Meta, StoryObj } from '@storybook/nextjs';
import { useStorybookText } from '@/.storybook/fixture-i18n';
import { Field } from '../Field';
import { LayoutStack } from '../Layout';
import { InputFrame } from './InputFrame';
import { Textarea } from './Textarea';

const meta: Meta<typeof InputFrame> = {
  title: 'Core/Input/InputFrame',
  component: InputFrame,
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof InputFrame>;

/** A hosted editable surface beside a native Textarea: both use the same Core chrome and focus treatment. */
function Comparison({ invalid = false, disabled = false }: { invalid?: boolean; disabled?: boolean }) {
  const text = useStorybookText();
  return (
    <LayoutStack gap="lg">
      <Textarea label={text('Description')} minRows={3} error={invalid} disabled={disabled} />
      <Field label={text('Rich description')}>
        <InputFrame invalid={invalid} disabled={disabled}>
          <div
            role="textbox"
            aria-multiline="true"
            aria-label={text('Rich description')}
            contentEditable={!disabled}
            suppressContentEditableWarning
            style={{ minHeight: 96, padding: 8, outline: 'none' }}
          >
            {text('Hosted editor content')}
          </div>
        </InputFrame>
      </Field>
    </LayoutStack>
  );
}

export const Default: Story = { render: () => <Comparison /> };
export const Invalid: Story = { render: () => <Comparison invalid /> };
export const Disabled: Story = { render: () => <Comparison disabled /> };
