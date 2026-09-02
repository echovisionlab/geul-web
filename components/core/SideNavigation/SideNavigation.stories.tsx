import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { IconActivity, IconLayoutDashboard, IconSettings, IconUser, IconUsers, IconWorld } from '@tabler/icons-react';
import { SideNavigation, type SideNavigationSection } from './SideNavigation';

const StoryLink = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<'a'>>(({ href, onClick, ...props }, ref) => (
  <a
    ref={ref}
    {...props}
    href={href}
    onClick={(event) => {
      event.preventDefault();
      onClick?.(event);
    }}
  />
));
StoryLink.displayName = 'StoryLink';

const sections: readonly SideNavigationSection[] = [
  {
    key: 'root',
    items: [
      {
        key: 'dashboard',
        href: '/admin',
        label: 'Dashboard',
        icon: <IconLayoutDashboard aria-hidden />,
        active: true,
      },
    ],
  },
  {
    key: 'workspace',
    label: 'Workspace',
    icon: <IconWorld aria-hidden />,
    items: [
      {
        key: 'activity',
        href: '/admin/activity',
        label: 'Activity',
        icon: <IconActivity aria-hidden />,
      },
      {
        key: 'site',
        href: '/admin/site',
        label: 'Site',
        icon: <IconWorld aria-hidden />,
      },
    ],
  },
  {
    key: 'management',
    label: 'Management',
    icon: <IconUsers aria-hidden />,
    items: [
      {
        key: 'users',
        href: '/admin/users',
        label: 'Users',
        icon: <IconUsers aria-hidden />,
      },
      {
        key: 'profile',
        href: '/admin/profile',
        label: 'Profile',
        icon: <IconUser aria-hidden />,
      },
      {
        key: 'settings',
        href: '/admin/settings',
        label: 'Settings',
        icon: <IconSettings aria-hidden />,
      },
    ],
  },
];

function withActiveItem(itemKey: string, source = sections): readonly SideNavigationSection[] {
  return source.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      active: item.key === itemKey,
    })),
  }));
}

const meta = {
  title: 'Core/SideNavigation',
  component: SideNavigation,
  tags: ['side-navigation'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story, { args }) => (
      <div
        style={{
          width: args.mode === 'compact' ? 40 : 280,
          maxWidth: 'calc(100vw - 32px)',
          minHeight: 360,
          border: '1px solid var(--mantine-color-default-border)',
          background: 'var(--mantine-color-body)',
        }}
      >
        <Story />
      </div>
    ),
  ],
  args: {
    ariaLabel: 'Workspace navigation',
    sections,
    mode: 'expanded',
    openSectionKeys: ['workspace', 'management'],
    linkComponent: StoryLink,
    onToggleSection: () => {},
    onSelectItem: () => {},
  },
} satisfies Meta<typeof SideNavigation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {};

export const Compact: Story = {
  args: {
    mode: 'compact',
    openSectionKeys: [],
  },
};

export const NestedActive: Story = {
  args: {
    sections: withActiveItem('users'),
  },
};

export const CollapsedSections: Story = {
  args: {
    openSectionKeys: ['workspace'],
    onToggleSection: () => {},
  },
};

const longLabelSections: readonly SideNavigationSection[] = [
  {
    key: 'publishing-workflows',
    label: 'Publishing workflows and distribution controls',
    items: [
      {
        key: 'international-publication-settings',
        href: '/admin/publishing/international-settings',
        label: 'International publication settings with an intentionally long label',
        icon: <IconWorld aria-hidden />,
        active: true,
      },
      {
        key: 'collaborator-permissions',
        href: '/admin/publishing/collaborator-permissions',
        label: 'Collaborator permission management',
        icon: <IconUsers aria-hidden />,
      },
    ],
  },
];

export const LongLabels: Story = {
  args: {
    sections: longLabelSections,
    openSectionKeys: ['publishing-workflows'],
  },
};

export const Interaction: Story = {
  args: {
    sections: withActiveItem('settings'),
    onSelectItem: () => {},
  },
};
