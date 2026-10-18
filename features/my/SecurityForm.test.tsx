// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, within } from '@/test/render';
import type { SessionInfo } from '@/lib/types/user/model';
import { SecurityForm } from './SecurityForm';

const navigationMock = vi.hoisted(() => ({
  router: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
  searchParams: new URLSearchParams(),
}));
const identityMock = vi.hoisted(() => ({
  getConnectedProvidersAction: vi.fn(),
  revokeMyOtherSessionsAction: vi.fn(),
  revokeMySessionAction: vi.fn(),
}));
const accountMock = vi.hoisted(() => ({ requestAccountDeletionAction: vi.fn() }));
const reauthenticationMock = vi.hoisted(() => ({ startPrivilegedReauthentication: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => navigationMock.router,
  useSearchParams: () => navigationMock.searchParams,
}));
vi.mock('@/lib/actions/account', () => ({ requestAccountDeletionAction: accountMock.requestAccountDeletionAction }));
vi.mock('@/lib/actions/identity', () => identityMock);
vi.mock('@/lib/public-runtime-config', () => ({ getPublicAuthUrl: () => '/api/auth' }));
vi.mock('@/features/auth/login-redirect', () => ({
  clearAuthRedirect: vi.fn(),
  startPrivilegedReauthentication: reauthenticationMock.startPrivilegedReauthentication,
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;

const currentSession: SessionInfo = {
  id: 'session-current',
  active: true,
  current: true,
  authenticated_at: new Date().toISOString(),
  devices: [],
};

beforeEach(() => {
  navigationMock.router.push.mockReset();
  navigationMock.router.refresh.mockReset();
  navigationMock.router.replace.mockReset();
  navigationMock.searchParams = new URLSearchParams();
  identityMock.getConnectedProvidersAction.mockReset();
  identityMock.revokeMyOtherSessionsAction.mockReset().mockResolvedValue({});
  identityMock.revokeMySessionAction.mockReset().mockResolvedValue({});
  accountMock.requestAccountDeletionAction.mockReset().mockResolvedValue({ success: true, message: 'sent' });
  reauthenticationMock.startPrivilegedReauthentication.mockReset();
  sessionStorage.clear();
});

// The passkey section loads its Kratos settings flow; keep it pending so only its static surface renders.
const pendingPasskeyFlow = () => new Promise<never>(() => {});

function renderSecurityForm(overrides: Partial<ComponentProps<typeof SecurityForm>> = {}) {
  return render(
    <SecurityForm
      subjectId="user-1"
      initialSessions={[currentSession]}
      initialProviders={[{ provider: 'google', identifier: 'google-subject' }]}
      initialCanonicalEmail="johndoe@example.com"
      initialEmailCodeAvailable
      requestPasskeyFlow={pendingPasskeyFlow}
      {...overrides}
    />,
  );
}

describe('SecurityForm', () => {
  it('shows one canonical email with the passkey, social login and session sections and no MCP surface', () => {
    renderSecurityForm();

    expect(screen.getAllByText('johndoe@example.com')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /add email/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Set as primary email' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Passkeys' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Connected social logins' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Google' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Active sessions' })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Unknown · Unknown' })).getByText('This device')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/MCP/i);
  });

  it('starts the canonical email change verification flow without exposing the address in the URL', async () => {
    const { user } = renderSecurityForm();
    await user.click(screen.getByRole('button', { name: 'Change primary email' }));
    expect(navigationMock.router.push).toHaveBeenCalledWith('/verify');
    expect(navigationMock.router.push.mock.calls[0]?.[0]).not.toContain('johndoe@example.com');
  });
});
