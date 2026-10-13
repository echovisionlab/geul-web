import { useState } from 'react';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { Button } from '../Button';
import { NativeSelect, PasswordInput, TextInput } from '@/components/core';
import { Field } from './Field';

const meta: Meta<typeof Field> = {
  title: 'Core/Layout/Field',
  component: Field,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 'min(420px, 100%)' }}>
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

function PasswordFieldPreview() {
  const [password, setPassword] = useState('');
  return (
    <Field
      label="Password"
      description="Use at least 12 characters."
      required
      htmlFor="field-story-password"
      actions={
        <Button emphasis="low" size="compact" onClick={() => setPassword(crypto.randomUUID())}>
          Generate
        </Button>
      }
    >
      <PasswordInput
        id="field-story-password"
        value={password}
        onChange={(event) => setPassword(event.currentTarget.value)}
        placeholder="Password"
      />
    </Field>
  );
}
export const RequiredWithAction: Story = { render: localizedRender(() => <PasswordFieldPreview />) };

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
  render: localizedRender(() => (
    <DsLayoutStack gap="lg">
      <Field label="Display name" description="Shown publicly on profile pages." htmlFor="field-story-matrix-name">
        <TextInput placeholder="Name" />
      </Field>
      <Field label="Email" error="Enter a valid email address." htmlFor="field-story-matrix-email">
        <TextInput placeholder="name@example.com" />
      </Field>
    </DsLayoutStack>
  )),
};

export const Inline: Story = {
  args: {
    layout: 'inline',
    label: 'Language',
    description: 'Language',
    htmlFor: 'field-inline-language',
    children: <NativeSelect density="compact" data={['English', '한국어']} />,
  },
};

export const ReadOnly: Story = {
  args: {
    label: 'Display name',
    description: 'This value can be reviewed but cannot be edited.',
    htmlFor: 'field-readonly-name',
    required: true,
    children: <TextInput defaultValue="Example Studio" readOnly />,
  },
};

export const LongContent: Story = {
  args: {
    layout: 'inline',
    label: 'Language used for the source text and all subsequent translations',
    description: 'Keep this source language consistent when reviewing translated content and its publication settings.',
    error: 'Choose the language that matches the source text before saving these changes.',
    htmlFor: 'field-long-language',
    required: true,
    actions: (
      <Button emphasis="low" size="compact">
        Review
      </Button>
    ),
    children: <NativeSelect density="compact" data={['English — source language for this publication', '한국어']} />,
  },
};

export const EditableLabel: Story = {
  args: {
    label: 'Description',
    description: 'Activate the label to focus the editable description.',
    htmlFor: 'field-editable-description',
    children: (
      <div
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Description"
        aria-multiline="true"
        tabIndex={0}
      >
        Editable description
      </div>
    ),
  },
};
