import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutContainer } from '@/components/core/Layout';
import { MyProfilePageView } from '@/features/my/MyProfilePageView';
import { MySecurityPageView } from '@/features/my/MySecurityPageView';
import { MySettingsPageView } from '@/features/my/MySettingsPageView';
import { createLocalTokenBindings } from './fixtures/personal-access-tokens';
import { SessionProvider } from '@/lib/providers/SessionProvider';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { accountAccessibilityLabels } from './AccountAccessibility';
export function MyAccountPagesPreview({
  surface = 'profile',
  role = 'author',
  state = 'ready',
}: {
  surface?: 'profile' | 'security' | 'settings';
  role?: 'author' | 'user';
  state?: 'ready' | 'failed' | 'pending';
}) {
  const [tokenBindings] = useState(() => createLocalTokenBindings(state === 'failed'));
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const failed = state === 'failed';
  return (
    <QueryClientProvider client={client}>
      <SessionProvider initialData={null}>
        <LayoutContainer size="standard" inset="md">
          {surface === 'profile' ? (
            <MyProfilePageView
              initialUser={{
                id: 'local-member',
                nickname: 'June Han',
                role,
                bio: 'Field recordings and shared listening.',
                website: 'https://example.com',
                socialLinks: { github: 'https://github.com/example' },
              }}
              disabled={state === 'pending'}
              checkNickname={async () => (failed ? { error: 'Local nickname check failed' } : { available: true })}
              updateAction={async () => (failed ? { error: 'Local profile save failed' } : {})}
            />
          ) : surface === 'security' ? (
            <MySecurityPageView
              subjectId="local-member"
              availableMethods={{ socialConnections: false, passkeys: false, accountDeletion: false }}
              initialSessions={[
                {
                  id: 'local-current',
                  active: true,
                  current: true,
                  authenticated_at: '2026-10-01T00:00:00Z',
                  devices: [{ user_agent: 'Mozilla/5.0 Chrome/130.0.0.0', ip_address: '192.0.2.1' }],
                },
                {
                  id: 'local-other',
                  active: true,
                  authenticated_at: '2026-09-30T00:00:00Z',
                  devices: [{ user_agent: 'Mozilla/5.0 Safari/605.1.15', ip_address: '192.0.2.2' }],
                },
              ]}
              initialProviders={[]}
              initialCanonicalEmail="june@example.com"
              initialEmailCodeAvailable
              error={failed ? 'Local security lookup failed' : undefined}
              bindings={{
                getConnectedProvidersAction: async () => ({
                  providers: [],
                  canonicalEmail: 'june@example.com',
                  emailCodeAvailable: true,
                }),
                revokeMySessionAction: async () => ({}),
                revokeMyOtherSessionsAction: async () => ({}),
                requestAccountDeletionAction: async () => ({
                  success: false,
                  message: 'Local account deletion simulation disabled',
                }),
              }}
              requestPasskeyFlow={async () =>
                state === 'pending'
                  ? new Promise(() => {})
                  : {
                      flowId: 'local-passkey-flow',
                      csrfToken: 'local-fixture',
                      flow: { id: 'local-passkey-flow', ui: { nodes: [] } },
                    }
              }
            />
          ) : (
            <MySettingsPageView
              email="june@example.com"
              preferredLocale="ko"
              subscribed
              analytics={false}
              cookieUpdatedAt="2026-10-01T00:00:00Z"
              subjectId="local-member"
              canAccessMcp={role === 'author'}
              personalAccessTokenItems={[]}
              tokensLoadFailed={failed}
              grants={[]}
              grantsLoadFailed={failed}
              endpoint="https://preview.invalid/mcp"
              setupGuideUrl="/fixtures/remote-mcp-preview.md"
              preferences={{
                language: async (locale) =>
                  failed ? { error: 'Local locale save failed' } : { success: true, preferred_locale: locale },
                newsletter: async () => ({
                  success: !failed,
                  message: failed ? 'Local subscription failed' : 'Local subscription saved',
                }),
                cookies: async () => ({
                  success: !failed,
                  persisted: !failed,
                  error: failed ? 'Local consent save failed' : undefined,
                }),
                refresh: () => {},
              }}
              tokenBindings={tokenBindings}
              revokeGrant={async () => (failed ? { error: 'Local revocation failed' } : { success: true as const })}
            />
          )}
        </LayoutContainer>
      </SessionProvider>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Account/Full Pages',
  excludeStories: ['MyAccountPagesPreview'],
  component: MyAccountPagesPreview,
  args: { surface: 'profile', role: 'author', state: 'ready' },
  render: (args) => <MyAccountPagesPreview key={`${args.surface}:${args.role}:${args.state}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/my/profile', query: {} } },
    docs: {
      description: {
        component:
          'Complete production MyProfilePageView, MySecurityPageView and MySettingsPageView compositions, original preference/profile/security controllers and typed local callbacks. Server session freshness/role projection, OAuth/passkey ceremonies, identity persistence and credential issuance are outside. Token creation, regeneration and deletion update local rows and preview-only secrets that cannot authenticate.',
      },
    },
  },
} satisfies Meta<typeof MyAccountPagesPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Profile: Story = {};
export const BasicProfile: Story = { args: { role: 'user' } };
export const ProfileFailed: Story = { args: { state: 'failed' } };
export const ProfileDisabled: Story = { args: { state: 'pending' } };
export const Security: Story = {
  args: { surface: 'security' },
  parameters: { nextjs: { navigation: { pathname: '/my/security', query: {} } } },
};
export const SecurityFailed: Story = { args: { surface: 'security', state: 'failed' } };
export const SecurityPending: Story = { args: { surface: 'security', state: 'pending' } };
export const Settings: Story = {
  args: { surface: 'settings' },
  parameters: { nextjs: { navigation: { pathname: '/my/settings', query: {} } } },
};
export const BasicSettings: Story = { args: { surface: 'settings', role: 'user' } };
export const SettingsFailed: Story = { args: { surface: 'settings', state: 'failed' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const KeyboardProfileLinks: Story = {
  tags: ['a11y-account'],
  play: async ({ canvasElement, globals }) => {
    const { common } = await accountAccessibilityLabels(globals);
    const canvas = within(canvasElement);
    const add = canvasElement.querySelector<HTMLElement>('[data-social-link-add]')!;
    await expect(add).toHaveAccessibleName();
    add.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(canvasElement.querySelectorAll('[data-social-link-row]')).toHaveLength(2));
    const rows = canvasElement.querySelectorAll<HTMLElement>('[data-social-link-row]');
    await expect(rows[1].contains(canvasElement.ownerDocument.activeElement)).toBe(true);
    const handle = rows[1].querySelector<HTMLElement>('[data-social-link-handle]')!;
    handle.focus();
    await expect(handle).toHaveAccessibleDescription();
    await userEvent.keyboard('{ArrowUp}');
    await expect(handle).toHaveFocus();
    await expect(canvasElement.querySelector('[data-social-link-row]')).toBe(rows[1]);
    const remove = rows[1].querySelector<HTMLElement>('[data-social-link-remove]')!;
    remove.focus();
    await userEvent.keyboard('{Enter}');
    await expect(canvasElement.querySelectorAll('[data-social-link-row]')).toHaveLength(1);
    await expect(canvasElement.querySelector('[data-social-link-remove]')).toHaveFocus();
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent(common('labels.profile'));
  },
};
