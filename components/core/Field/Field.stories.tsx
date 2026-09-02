import type { Meta, StoryObj } from '@storybook/nextjs';
import { Button, PasswordInput, Stack, TextInput } from '@mantine/core';
import { Field } from './Field';

const meta: Meta<typeof Field> = {
  title: 'Core/Field',
  component: Field,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Field>;

export const Basic: Story = {
  args: {
    label: 'Display name',
    description: 'Shown publicly on profile pages.',
    htmlFor: 'field-story-display-name',
    children: <TextInput placeholder="Name" />,
  },
};

export const RequiredWithAction: Story = {
  args: {
    label: 'Password',
    description: 'Use at least 12 characters.',
    required: true,
    htmlFor: 'field-story-password',
    actions: (
      <Button variant="subtle" size="compact-xs">
        Generate
      </Button>
    ),
    children: <PasswordInput placeholder="Password" />,
  },
};

export const ErrorState: Story = {
  args: {
    label: 'Email',
    description: 'Used for account notifications.',
    error: 'Enter a valid email address.',
    htmlFor: 'field-story-email',
    children: <TextInput placeholder="name@example.com" />,
  },
};

export const StateMatrix: Story = {
  render: () => (
    <Stack gap="lg">
      <Field label="Display name" description="Shown publicly on profile pages." htmlFor="field-story-matrix-name">
        <TextInput placeholder="Name" />
      </Field>
      <Field label="Email" error="Enter a valid email address." htmlFor="field-story-matrix-email">
        <TextInput placeholder="name@example.com" />
      </Field>
    </Stack>
  ),
};
