import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent } from 'storybook/test';

import { PasswordInput } from './PasswordInput';

const meta = {
  title: 'Core/Input/PasswordInput',
  component: PasswordInput,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The visibility command uses the shared Core glyph frame with Eye/EyeOff icons. It preserves the password value, accessible show/hide name, pressed state and keyboard focus. Disabled fields disable the command; read-only fields still allow inspection. Controlled visibility changes are requested through onVisibilityChange.',
      },
    },
  },
  args: {
    label: 'Password',
    placeholder: 'Enter a password',
  },
} satisfies Meta<typeof PasswordInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  args: { defaultValue: 'secret-value' },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector<HTMLInputElement>('input')!;
    const toggle = canvasElement.querySelector<HTMLButtonElement>('button')!;
    const document = canvasElement.ownerDocument;
    const rootStyle = getComputedStyle(document.documentElement);
    const glyph = rootStyle.getPropertyValue('--geul-chrome-icon-size').trim();
    const frame = Number.parseFloat(glyph) * (glyph.endsWith('rem') ? Number.parseFloat(rootStyle.fontSize) : 1);
    const assertGlyph = async () => {
      const svg = toggle.querySelector('svg')!;
      await expect(svg).toHaveAttribute('aria-hidden', 'true');
      await expect(svg.getBoundingClientRect().width).toBeCloseTo(frame, 1);
      await expect(svg.getBoundingClientRect().height).toBeCloseTo(frame, 1);
      await expect(toggle.textContent).toBe('');
    };
    await assertGlyph();
    const showName = toggle.getAttribute('aria-label');
    await expect(toggle).toHaveAccessibleName(showName!);
    input.focus();
    await userEvent.keyboard('{Tab}');
    await expect(toggle).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect(input).toHaveAttribute('type', 'text');
    await expect(input).toHaveValue('secret-value');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle.getAttribute('aria-label')).not.toBe(showName);
    await expect(toggle).toHaveFocus();
    await assertGlyph();
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveAttribute('type', 'password');
    await expect(input).toHaveValue('secret-value');
    await expect(toggle).toHaveAccessibleName(showName!);
    await expect(toggle).toHaveFocus();
  },
};
export const Error: Story = {
  args: { error: 'Password does not meet the requirements' },
};
export const Disabled: Story = {
  args: { defaultValue: 'secret-value', disabled: true },
};
export const ReadOnly: Story = { args: { defaultValue: 'example-passphrase', readOnly: true } };
export const Visible: Story = { args: { defaultValue: 'example-passphrase', defaultVisible: true } };
