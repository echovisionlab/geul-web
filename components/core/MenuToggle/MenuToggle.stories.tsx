import { useState } from 'react';
import { useArgs } from 'storybook/preview-api';
import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { MenuToggle, type MenuToggleProps } from './MenuToggle';

function MenuToggleExample(props: Omit<MenuToggleProps, 'opened' | 'onClick'>) {
  const [opened, setOpened] = useState(false);
  return <MenuToggle {...props} opened={opened} onClick={() => setOpened(!opened)} />;
}

const meta = {
  title: 'Core/Navigation/MenuToggle',
  component: MenuToggle,
  parameters: { layout: 'centered' },
  render: function TogglePreview(args) {
    const [, updateArgs] = useArgs();
    return <MenuToggle {...args} onClick={() => updateArgs({ opened: !args.opened })} />;
  },
  args: {
    label: 'Toggle menu',
    opened: false,
    onClick: () => {},
  },
} satisfies Meta<typeof MenuToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {
  render: localizedRender((args) => <MenuToggleExample {...args} />),
};

export const Opened: Story = {
  args: {
    opened: true,
    onClick: () => {},
  },
};

export const Disabled: Story = {
  args: {
    opened: false,
    disabled: true,
    onClick: () => {},
  },
};

export const Loading: Story = {
  args: { opened: true, loading: true, controls: 'pending-navigation' },
  render: function LoadingPreview(args) {
    const [, updateArgs] = useArgs();
    return (
      <>
        <MenuToggle {...args} onClick={() => updateArgs({ opened: !args.opened })} />
        <nav id={args.controls} aria-label="Primary navigation" aria-busy={args.loading} hidden={!args.opened}>
          Loading navigation…
        </nav>
      </>
    );
  },
};
