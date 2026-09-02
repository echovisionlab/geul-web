import type { Meta, StoryObj } from '@storybook/nextjs';

import { MenuToggle, type MenuToggleProps } from './MenuToggle';

function MenuToggleExample(props: Omit<MenuToggleProps, 'opened' | 'onClick'>) {
  return <MenuToggle {...props} opened={false} onClick={() => {}} />;
}

const meta = {
  title: 'Core/Navigation/MenuToggle',
  component: MenuToggle,
  parameters: { layout: 'centered' },
  args: {
    label: 'Toggle menu',
    opened: false,
    onClick: () => {},
  },
} satisfies Meta<typeof MenuToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {
  render: (args) => <MenuToggleExample {...args} />,
};

export const Compact: Story = {
  render: (args) => <MenuToggleExample {...args} size="compact" />,
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
