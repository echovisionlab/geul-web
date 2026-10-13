import { useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { localizedRender, useStorybookText } from '@/.storybook/fixture-i18n';
import { Button } from '../Button';
import { LayoutStack } from '../Layout';
import { TextInput } from '../Input';
import { DisclosureRegion } from './Disclosure';

function Example() {
  const text = useStorybookText();
  const id = useId();
  const [expanded, setExpanded] = useState(true);
  return (
    <LayoutStack gap="sm">
      <Button aria-controls={id} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        {text(expanded ? 'Hide' : 'Edit')}
      </Button>
      <DisclosureRegion id={id} expanded={expanded}>
        <TextInput label={text('Name')} defaultValue="Monome" />
      </DisclosureRegion>
    </LayoutStack>
  );
}
const meta = {
  title: 'Core/Interaction/DisclosureRegion',
  component: DisclosureRegion,
  args: { expanded: true },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof DisclosureRegion>;
export default meta;
type Story = StoryObj<typeof meta>;
export const RetainedForm: Story = { args: {}, render: localizedRender(() => <Example />) };
