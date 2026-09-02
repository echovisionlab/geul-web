'use client';

import type { ComponentType, ReactNode } from 'react';
import type { IconProps } from '@tabler/icons-react';
import { Container, Stack, Text } from '@mantine/core';
import { LabelBadge, type BadgeTone } from '@/components/core/Badge';
import { Tabs } from '@/components/core/Tabs';

export interface UserShellViewUser {
  name: string;
  roleLabel: string;
  roleTone: BadgeTone;
  navigationLabel: string;
}

export interface UserShellViewTab {
  value: string;
  label: string;
  icon: ComponentType<IconProps>;
}

export interface UserShellViewEvents {
  onTabChange: (value: string | null) => void;
}

export interface UserShellViewProps {
  user: UserShellViewUser;
  tabs: UserShellViewTab[];
  currentTab: string;
  events: UserShellViewEvents;
  avatarSlot: ReactNode;
  children: ReactNode;
}

/** Pure layout for the signed-in user's account area. */
export function UserShellView({ user, tabs, currentTab, events, avatarSlot, children }: UserShellViewProps) {
  return (
    <Container size="sm" py="lg">
      <Stack align="center" mb="lg">
        {avatarSlot}
        <Stack gap={4} align="center">
          <Text size="md" fw={600}>
            {user.name}
          </Text>
          <LabelBadge tone={user.roleTone} size="xs" mt={2}>
            {user.roleLabel}
          </LabelBadge>
        </Stack>
      </Stack>

      <Tabs value={currentTab} onChange={events.onTabChange} mb="lg">
        <Tabs.List
          aria-label={user.navigationLabel}
          data-user-shell-tab-list
          style={{
            flexWrap: 'wrap',
            maxWidth: '100%',
          }}
        >
          {tabs.map((tab) => (
            <Tabs.Tab
              key={tab.value}
              value={tab.value}
              leftSection={<tab.icon size={16} aria-hidden />}
              data-user-shell-tab={tab.value}
              style={{ flexShrink: 0 }}
            >
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      {children}
    </Container>
  );
}
