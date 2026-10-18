// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act, type ComponentProps } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import koMessages from '@/messages/ko.json';
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
vi.mock('./PasskeySettingsSection', () => ({
  PasskeySettingsSection: () => <div data-testid="security-passkeys-section" />,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: () => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }),
});
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
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
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

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderSecurityForm(overrides: Partial<ComponentProps<typeof SecurityForm>> = {}) {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="ko" messages={koMessages}>
        <DesignSystemProvider locale="ko" forceColorScheme="light">
          <SecurityForm
            subjectId="user-1"
            initialSessions={[currentSession]}
            initialProviders={[{ provider: 'google', identifier: 'google-subject' }]}
            initialCanonicalEmail="johndoe@example.com"
            initialEmailCodeAvailable
            {...overrides}
          />
        </DesignSystemProvider>
      </NextIntlClientProvider>,
    );
  });
}

describe('SecurityForm', () => {
  it('starts the canonical email change verification flow without exposing the address in the URL', () => {
    renderSecurityForm();
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="security-change-email"]')?.click());
    expect(navigationMock.router.push).toHaveBeenCalledWith('/verify');
    expect(navigationMock.router.push.mock.calls[0]?.[0]).not.toContain('johndoe@example.com');
  });
});
