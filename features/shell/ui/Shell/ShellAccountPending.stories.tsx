import type { Meta, StoryObj } from '@storybook/nextjs';
import { LayoutStack } from '@/components/core/Layout';
import { ShellAccountDesktop, ShellAccountMobile } from './ShellIslands';
import { ShellStateProvider } from './shell-state';
import type { ShellState } from './shell-types';

function AccountPreview({ pending }: { pending: boolean }) {
  const state: ShellState = {
    navigationOpened: false,
    userMenuOpened: false,
    signOutPending: pending,
    themeMode: 'light',
    loginHref: '/login',
    showChangelog: false,
    user: {
      kind: 'authenticated',
      name: 'June Han',
      email: 'june@example.test',
      imageUrls: { compact: null, mobile: null, detail: null },
    },
    isItemActive: () => false,
    labels: {
      searchTooltip: 'Search',
      themeTooltip: 'Theme',
      navigationLoadFailed: 'Could not load navigation.',
      retryNavigation: 'Retry navigation',
    },
    events: {
      onToggleNavigation: () => {},
      onOpenUserMenu: () => {},
      onCloseUserMenu: () => {},
      onSearch: () => {},
      onToggleColorScheme: () => {},
      onSignOut: () => {},
      onOpenCookieSettings: () => {},
      onNavigate: () => {},
    },
  };
  const labels = { account: 'Account', logOut: 'Sign out', signIn: 'Sign in' };
  return (
    <ShellStateProvider value={state}>
      <LayoutStack align="start">
        <ShellAccountDesktop items={[]} labels={labels} />
        <ShellAccountMobile labels={labels} />
      </LayoutStack>
    </ShellStateProvider>
  );
}
const meta: Meta<typeof AccountPreview> = {
  title: 'Feature/Shell/Account Pending',
  component: AccountPreview,
  args: { pending: false },
  parameters: {
    docs: {
      description: {
        component:
          'Production desktop and mobile account triggers with explicit controller state. Pending represents edit settlement or the sign-out redirect; the fixture sends no authentication request.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof AccountPreview>;
export const Default: Story = {};
export const SigningOut: Story = { args: { pending: true } };
