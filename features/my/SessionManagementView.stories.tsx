import { useArgs } from 'storybook/preview-api';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { withFeatureLabels } from '@/stories/feature-localization';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { DEFAULT_LOCALE } from '@/lib/i18n/locale';

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
  render: function InteractiveStory(args) {
    const [, updateArgs] = useArgs();
    return (
      <SessionManagementView
        {...args}
        onRevokeSession={(id) => updateArgs({ sessions: args.sessions.filter((session) => session.id !== id) })}
        onRevokeOtherSessions={() =>
          updateArgs({ sessions: args.sessions.filter((session) => session.id === args.currentSessionId) })
        }
      />
    );
  },
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The bulk logout command sits at the end of its action row. Session-specific commands retain row descriptions; revocation preserves the current session and restores focus when controls disappear. The layout follows the document direction, including RTL.',
      },
    },
  },
  decorators: [
    withFeatureLabels({
      localeProp: true,
      labels: {
        activeNow: 'security.sessions.activeNow',
        description: 'security.sessions.description',
        logOutOthers: 'security.sessions.logoutOthers',
        revoke: 'security.sessions.revoke',
        thisDevice: 'security.sessions.thisDevice',
        title: 'security.sessions.title',
        browser: (t) => (value: string) =>
          t(value === 'unknown' ? 'common.states.unknown' : `security.sessions.browser.${value}`),
        device: (t) => (value: string) =>
          t(value === 'unknown' ? 'common.states.unknown' : `security.sessions.device.${value}`),
        os: (t) => (value: string) =>
          t(value === 'unknown' ? 'common.states.unknown' : `security.sessions.os.${value}`),
      },
    }),
    (Story) => (
      <div style={{ width: 620, maxWidth: '100%' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    currentSessionId: 'current-session',
    locale: DEFAULT_LOCALE,
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

    onRevokeOtherSessions: () => {},
    onRevokeSession: () => {},
    revokingSessionId: null,
    revokeOthersLoading: false,
    sessions,
  },
} satisfies Meta<typeof SessionManagementView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MultipleSessions: Story = {
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector<HTMLElement>('[data-testid="security-session-actions"]')!;
    const action = row.querySelector<HTMLElement>('[data-testid="security-revoke-other-sessions"]')!;
    const rowBounds = row.getBoundingClientRect();
    const actionBounds = action.getBoundingClientRect();
    const rtl = getComputedStyle(row).direction === 'rtl';
    const endGap = rtl ? actionBounds.left - rowBounds.left : rowBounds.right - actionBounds.right;
    await expect(Math.abs(endGap)).toBeLessThanOrEqual(1);
    await expect(action).toHaveAccessibleName();
  },
};
export const RevokingOneSession: Story = { args: { revokingSessionId: 'phone-session' } };
export const RevokingAllOtherSessions: Story = { args: { revokeOthersLoading: true } };
export const OnlyCurrentSession: Story = { args: { sessions: [sessions[0]] } };

export const KeyboardRevocation: Story = {
  tags: ['a11y-account'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = canvasElement.querySelector<HTMLElement>('[data-testid="security-revoke-session-phone-session"]')!;
    await expect(first).toHaveAccessibleDescription(expect.stringContaining('203.0.113.*'));
    first.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-testid="security-revoke-session-phone-session"]')).toBeNull(),
    );
    const next = canvasElement.querySelector<HTMLElement>('[data-testid="security-revoke-session-desktop-session"]')!;
    await expect(next).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-testid="security-revoke-session-desktop-session"]')).toBeNull(),
    );
    await expect(canvas.getByRole('heading', { level: 2 })).toHaveFocus();
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
  },
};
