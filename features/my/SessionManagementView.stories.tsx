import type { Meta, StoryObj } from '@storybook/nextjs';
import { Box } from '@mantine/core';
import { SessionManagementView, type SessionManagementItem } from './ui/SessionManagement';

const sessions: SessionManagementItem[] = [
  {
    id: 'current-session',
    active: true,
    authenticatedAt: '2026-08-18T08:00:00Z',
    device: {
      ipAddress: '192.168.10.25',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
    },
  },
  {
    id: 'phone-session',
    active: true,
    authenticatedAt: '2026-08-18T07:55:00Z',
    device: {
      ipAddress: '203.0.113.40',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile Safari/604.1',
    },
  },
  {
    id: 'desktop-session',
    active: true,
    authenticatedAt: '2026-08-18T07:00:00Z',
    device: {
      ipAddress: '2001:db8:abcd:12::1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0 Safari/537.36',
    },
  },
];

const meta = {
  title: 'Feature/My/Session Management',
  component: SessionManagementView,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <Box w={620} maw="calc(100vw - 2rem)">
        <Story />
      </Box>
    ),
  ],
  args: {
    currentSessionId: 'current-session',
    labels: {
      activeNow: 'Active now',
      browser: (value) => value,
      description: 'Review and revoke active sessions.',
      device: (value) => value,
      logOutOthers: 'Log out other sessions',
      os: (value) => value,
      revoke: 'Revoke',
      thisDevice: 'This device',
      title: 'Sessions',
    },
    locale: 'en',
    onRevokeOtherSessions: () => {},
    onRevokeSession: () => {},
    revokingSessionId: null,
    revokeOthersLoading: false,
    sessions,
  },
} satisfies Meta<typeof SessionManagementView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MultipleSessions: Story = {};
export const RevokingOneSession: Story = { args: { revokingSessionId: 'phone-session' } };
export const RevokingAllOtherSessions: Story = { args: { revokeOthersLoading: true } };
export const OnlyCurrentSession: Story = { args: { sessions: [sessions[0]] } };
