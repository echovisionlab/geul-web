import { useArgs } from 'storybook/preview-api';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { IconActivity, IconLayoutDashboard, IconSettings, IconUser, IconUsers, IconWorld } from '@tabler/icons-react';
import { SideNavigation, type SideNavigationSection } from './SideNavigation';

const sections: readonly SideNavigationSection[] = [
  {
    key: 'root',
    items: [
      {
        key: 'dashboard',
        href: '#preview-admin',
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
        href: '#preview-admin/activity',
        label: 'Activity',
        icon: <IconActivity aria-hidden />,
      },
      {
        key: 'site',
        href: '#preview-admin/site',
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
        href: '#preview-admin/users',
        label: 'Users',
        icon: <IconUsers aria-hidden />,
      },
      {
        key: 'profile',
        href: '#preview-admin/profile',
        label: 'Profile',
        icon: <IconUser aria-hidden />,
      },
      {
        key: 'settings',
        href: '#preview-admin/settings',
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
  title: 'Core/Navigation/SideNavigation',
  component: SideNavigation,
  tags: ['side-navigation'],
  render: function NavigationPreview(args) {
    const [, updateArgs] = useArgs();
    return (
      <SideNavigation
        {...args}
        onToggleSection={(key) =>
          updateArgs({
            openSectionKeys: args.openSectionKeys.includes(key)
              ? args.openSectionKeys.filter((item) => item !== key)
              : [...args.openSectionKeys, key],
          })
        }
        onSelectItem={(item) => updateArgs({ sections: withActiveItem(item.key, args.sections) })}
      />
    );
  },
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
          border: '1px solid var(--geul-border-default)',
          background: 'var(--geul-background)',
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
        href: '#preview-admin/publishing/international-settings',
        label: 'International publication settings with an intentionally long label',
        icon: <IconWorld aria-hidden />,
        active: true,
      },
      {
        key: 'collaborator-permissions',
        href: '#preview-admin/publishing/collaborator-permissions',
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
