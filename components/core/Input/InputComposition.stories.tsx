import type { SubmitEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { Stack } from '@mantine/core';
import { Button } from '../Button';
import { Checkbox } from './Checkbox';
import { MultiSelect } from './MultiSelect';
import { Select } from './Select';
import { Textarea } from './Textarea';
import { TextInput } from './TextInput';

interface ProfileFormCompositionProps {
  onSubmit: () => void;
}

function ProfileFormComposition({ onSubmit }: ProfileFormCompositionProps) {
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md" w="min(420px, 88vw)">
        <TextInput label="Display name" placeholder="Enter a display name" required />
        <Select label="Language" placeholder="Choose a language" data={['English', 'Korean', 'Japanese']} />
        <MultiSelect
          label="Disciplines"
          placeholder="Choose disciplines"
          data={['Installation', 'Performance', 'Sound art']}
        />
        <Textarea label="Bio" placeholder="Write a short bio" minRows={4} />
        <Checkbox label="Show this profile publicly" defaultChecked />
        <Button type="submit">Save profile</Button>
      </Stack>
    </form>
  );
}

const meta = {
  title: 'Core/Input/Composition/ProfileForm',
  component: ProfileFormComposition,
  parameters: { layout: 'centered' },
  args: { onSubmit: () => {} },
} satisfies Meta<typeof ProfileFormComposition>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
