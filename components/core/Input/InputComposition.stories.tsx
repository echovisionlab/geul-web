import { localizeFixtureTree, useStorybookText } from '@/.storybook/fixture-i18n';
import { useState, type SubmitEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { LayoutStack as Stack } from '../Layout';
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
  const text = useStorybookText();
  const [saved, setSaved] = useState(false);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
    setSaved(true);
  };

  return localizeFixtureTree(
    <form onSubmit={handleSubmit} onChange={() => setSaved(false)}>
      <Stack gap="md">
        <TextInput label="Display name" placeholder="Enter a display name" required />
        <Select label="Language" placeholder="Choose a language" data={['English', 'Korean', 'Japanese']} />
        <MultiSelect
          label="Disciplines"
          placeholder="Choose disciplines"
          data={['Installation', 'Performance', 'Sound art']}
        />
        <Textarea label="Bio" placeholder="Write a short bio" minRows={4} />
        <Checkbox label="Show this profile publicly" defaultChecked />
        <Button type="submit" disabled={saved}>
          {saved ? 'Profile saved' : 'Save profile'}
        </Button>
      </Stack>
    </form>,
    text,
  );
}

const meta = {
  title: 'Composition/Profile Form',
  component: ProfileFormComposition,
  parameters: { layout: 'centered' },
  args: { onSubmit: () => {} },
} satisfies Meta<typeof ProfileFormComposition>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
