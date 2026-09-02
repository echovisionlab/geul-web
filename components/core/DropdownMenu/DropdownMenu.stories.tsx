import { forwardRef } from 'react';
import {
  IconArchive,
  IconCopy,
  IconDownload,
  IconEdit,
  IconFile,
  IconFolder,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { Button, type ButtonProps } from '../Button';
import { DropdownMenu } from './DropdownMenu';

const DropdownMenuTrigger = forwardRef<HTMLButtonElement, ButtonProps>(({ children, ...props }, ref) => {
  return (
    <Button ref={ref} {...props} size="sm" tone="neutral" emphasis="medium">
      {children}
    </Button>
  );
});

DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

const meta: Meta<typeof DropdownMenu> = {
  title: 'Core/DropdownMenu',
  component: DropdownMenu,
  tags: ['core-dropdown-menu'],
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

export const DefaultCommandDropdownMenu: Story = {
  render: () => (
    <DropdownMenu defaultOpen portal={false}>
      <DropdownMenu.Target>
        <DropdownMenuTrigger>Open command menu</DropdownMenuTrigger>
      </DropdownMenu.Target>
      <DropdownMenu.Dropdown>
        <DropdownMenu.Label>Document</DropdownMenu.Label>
        <DropdownMenu.Item>New document</DropdownMenu.Item>
        <DropdownMenu.Item>Duplicate</DropdownMenu.Item>
        <DropdownMenu.Divider />
        <DropdownMenu.Item>Archive</DropdownMenu.Item>
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  ),
};

export const IconItems: Story = {
  render: () => (
    <DropdownMenu portal={false}>
      <DropdownMenu.Target>
        <DropdownMenuTrigger>File actions</DropdownMenuTrigger>
      </DropdownMenu.Target>
      <DropdownMenu.Dropdown>
        <DropdownMenu.Item icon={<IconPlus size={16} />}>New file</DropdownMenu.Item>
        <DropdownMenu.Item icon={<IconEdit size={16} />}>Rename</DropdownMenu.Item>
        <DropdownMenu.Item icon={<IconCopy size={16} />}>Make a copy</DropdownMenu.Item>
        <DropdownMenu.Item icon={<IconArchive size={16} />}>Archive</DropdownMenu.Item>
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  ),
};

export const DisabledItems: Story = {
  render: () => (
    <DropdownMenu portal={false}>
      <DropdownMenu.Target>
        <DropdownMenuTrigger>Publishing actions</DropdownMenuTrigger>
      </DropdownMenu.Target>
      <DropdownMenu.Dropdown>
        <DropdownMenu.Item>Save draft</DropdownMenu.Item>
        <DropdownMenu.Item disabled>Publish without permission</DropdownMenu.Item>
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  ),
};

export const DestructiveAction: Story = {
  render: () => (
    <DropdownMenu portal={false}>
      <DropdownMenu.Target>
        <DropdownMenuTrigger>Workspace actions</DropdownMenuTrigger>
      </DropdownMenu.Target>
      <DropdownMenu.Dropdown>
        <DropdownMenu.Item icon={<IconEdit size={16} />}>Rename workspace</DropdownMenu.Item>
        <DropdownMenu.Divider />
        <DropdownMenu.Item icon={<IconTrash size={16} />} tone="danger">
          Delete workspace
        </DropdownMenu.Item>
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  ),
};

export const NestedDropdownMenu: Story = {
  render: () => (
    <DropdownMenu size="wide" portal={false}>
      <DropdownMenu.Target>
        <DropdownMenuTrigger>Document actions</DropdownMenuTrigger>
      </DropdownMenu.Target>
      <DropdownMenu.Dropdown>
        <DropdownMenu.Item icon={<IconFile size={16} />}>Open document</DropdownMenu.Item>
        <DropdownMenu.Sub size="wide">
          <DropdownMenu.Sub.Target icon={<IconDownload size={16} />}>Export</DropdownMenu.Sub.Target>
          <DropdownMenu.Sub.Dropdown>
            <DropdownMenu.Item>Portable Document Format (PDF)</DropdownMenu.Item>
            <DropdownMenu.Item>OpenDocument Text</DropdownMenu.Item>
          </DropdownMenu.Sub.Dropdown>
        </DropdownMenu.Sub>
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  ),
};

export const LongLabels: Story = {
  render: () => (
    <DropdownMenu size="expanded" portal={false}>
      <DropdownMenu.Target>
        <DropdownMenuTrigger>Long label actions</DropdownMenuTrigger>
      </DropdownMenu.Target>
      <DropdownMenu.Dropdown>
        <DropdownMenu.Item icon={<IconFolder size={16} />}>
          Move to the quarterly planning and operational review workspace
        </DropdownMenu.Item>
        <DropdownMenu.Item>Open customer-delivery-acceptance-requirements-and-sign-off-checklist</DropdownMenu.Item>
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  ),
};
