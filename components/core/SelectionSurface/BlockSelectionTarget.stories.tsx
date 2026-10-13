import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useStorybookText } from '@/.storybook/fixture-i18n';
import { LayoutStack } from '../Layout';
import { Text } from '../Typography';
import { BlockSelectionTarget } from './BlockSelectionTarget';

const meta: Meta<typeof BlockSelectionTarget> = {
  title: 'Core/Interaction/BlockSelectionTarget',
  component: BlockSelectionTarget,
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof BlockSelectionTarget>;

/**
 * The block owns its geometry and persistent selected boundary; the target owns selection input and the
 * keyboard focus ring. `pass-through` keeps block content interactive, `capture` covers embedded frames.
 */
function Preview({ pointer }: { pointer: 'pass-through' | 'capture' }) {
  const text = useStorybookText();
  const [selected, setSelected] = useState(false);
  return (
    <LayoutStack gap="sm">
      <div style={{ position: 'relative', width: 320, maxWidth: '100%', padding: 24 }}>
        <Text size="sm">{text('Embedded block content')}</Text>
        <BlockSelectionTarget
          label={text('Select block')}
          pointer={pointer}
          onFocus={pointer === 'pass-through' ? () => setSelected(true) : undefined}
          onClick={() => setSelected(true)}
        />
      </div>
      <Text size="xs" tone="secondary" aria-live="polite">
        {selected ? text('Selected') : text('Not selected')}
      </Text>
    </LayoutStack>
  );
}

export const KeyboardTarget: Story = { render: () => <Preview pointer="pass-through" /> };
export const PointerShield: Story = { render: () => <Preview pointer="capture" /> };
