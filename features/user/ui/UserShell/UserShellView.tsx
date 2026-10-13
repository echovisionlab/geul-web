'use client';
import {
  LayoutContainer as DsLayoutContainer,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
  LayoutInset,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import type { ComponentType, ReactNode } from 'react';
import type { IconProps } from '@tabler/icons-react';
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
    <DsLayoutInset block="lg">
      <DsLayoutContainer size="compact">
        <DsLayoutInset blockEnd="lg">
          <DsLayoutStack align="center">
            {avatarSlot}
            <DsLayoutStack gap="xxs" align="center">
              <DsText size="md" weight="strong">
                {user.name}
              </DsText>
              <LayoutInset space="none" blockStart="xxs">
                <LabelBadge tone={user.roleTone}>{user.roleLabel}</LabelBadge>
              </LayoutInset>
            </DsLayoutStack>
          </DsLayoutStack>
        </DsLayoutInset>

        <Tabs value={currentTab} onChange={events.onTabChange}>
          <LayoutInset blockEnd="lg">
            <Tabs.List aria-label={user.navigationLabel} data-user-shell-tab-list wrap="wrap">
              {tabs.map((tab) => (
                <Tabs.Tab
                  key={tab.value}
                  value={tab.value}
                  leftSection={<tab.icon size={16} aria-hidden />}
                  data-user-shell-tab={tab.value}
                >
                  {tab.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </LayoutInset>

          <Tabs.Panel value={currentTab}>{children}</Tabs.Panel>
        </Tabs>
      </DsLayoutContainer>
    </DsLayoutInset>
  );
}
