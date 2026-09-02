// @vitest-environment jsdom

import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonalAccessTokenSettings } from './PersonalAccessTokenSettings';

const mocks = vi.hoisted(() => ({
  createAccount: vi.fn(),
  createMy: vi.fn(),
  copy: vi.fn(),
  deleteAccount: vi.fn(),
  deleteMy: vi.fn(),
  regenerateAccount: vi.fn(),
  regenerateMy: vi.fn(),
  searchParams: new URLSearchParams(),
  startPrivilegedReauthentication: vi.fn(),
  viewInstanceId: 0,
  viewMounts: 0,
  viewProps: null as Record<string, unknown> | null,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/my/settings',
  useSearchParams: () => mocks.searchParams,
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));
vi.mock('@/features/auth/login-redirect', () => ({
  startPrivilegedReauthentication: mocks.startPrivilegedReauthentication,
}));
vi.mock('@/lib/actions/personal-access-token', () => ({
  createAccountPersonalAccessTokenAction: mocks.createAccount,
  createMyPersonalAccessTokenAction: mocks.createMy,
  deleteAccountPersonalAccessTokenAction: mocks.deleteAccount,
  deleteMyPersonalAccessTokenAction: mocks.deleteMy,
  regenerateAccountPersonalAccessTokenAction: mocks.regenerateAccount,
  regenerateMyPersonalAccessTokenAction: mocks.regenerateMy,
}));
vi.mock('@/lib/hooks/useCopyToClipboard', () => ({ useCopyToClipboard: () => ({ copy: mocks.copy }) }));
vi.mock('@/lib/providers/LocaleProvider', () => ({ useLocale: () => 'en' }));
vi.mock('./ui/PersonalAccessTokenSettings', () => ({
  PersonalAccessTokenSettingsView: (props: Record<string, unknown>) => {
    const instanceId = useRef<number | null>(null);
    if (instanceId.current === null) {
      instanceId.current = ++mocks.viewMounts;
    }
    mocks.viewInstanceId = instanceId.current;
    mocks.viewProps = props;
    return null;
  },
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function viewProps() {
  expect(mocks.viewProps).not.toBeNull();
  return mocks.viewProps as {
    token: { id: string; canRegenerate: boolean } | null;
    pendingAction: string | null;
    secret: { value: string } | null;
    onCreate: () => Promise<boolean>;
    onDelete: (id: string) => Promise<boolean>;
    onRegenerate: (id: string) => Promise<boolean>;
  };
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.viewProps = null;
  mocks.viewInstanceId = 0;
  mocks.viewMounts = 0;
  mocks.searchParams = new URLSearchParams();
  for (const mock of [
    mocks.createAccount,
    mocks.createMy,
    mocks.deleteAccount,
    mocks.deleteMy,
    mocks.regenerateAccount,
    mocks.regenerateMy,
    mocks.copy,
    mocks.startPrivilegedReauthentication,
  ]) {
    mock.mockReset();
  }
  sessionStorage.clear();

  act(() => {
    root.render(<PersonalAccessTokenSettings subjectId="member-1" initialPersonalAccessTokens={[]} />);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('PersonalAccessTokenSettings controller', () => {
  it('stores only metadata while exposing the credential in the one-time secret surface', async () => {
    mocks.createMy.mockResolvedValue({
      personalAccessToken: { id: 'pat-1', createdAt: '2026-08-23T00:00:00.000Z' },
      secret: 'one-time-secret',
    });

    await act(async () => viewProps().onCreate());

    expect(mocks.createMy).toHaveBeenCalledWith();
    expect(viewProps().token).toMatchObject({ id: 'pat-1' });
    expect(viewProps().secret).toEqual({ value: 'one-time-secret' });
    expect(viewProps().token).not.toHaveProperty('secret');
  });

  it('uses the Admin target actions without changing the one-token view', async () => {
    mocks.createAccount.mockResolvedValue({
      personalAccessToken: { id: 'pat-admin', createdAt: '2026-08-23T00:00:00.000Z' },
      secret: 'admin-created-secret',
    });
    act(() => {
      root.render(<PersonalAccessTokenSettings subjectId="member-2" mode="admin" initialPersonalAccessTokens={[]} />);
    });

    await act(async () => viewProps().onCreate());

    expect(mocks.createAccount).toHaveBeenCalledWith('member-2');
    expect(viewProps().token).toMatchObject({ id: 'pat-admin' });
  });

  it('preserves a regeneration intent across the freshness redirect', async () => {
    mocks.regenerateMy.mockResolvedValue({ error: 'reauth_required' });
    act(() => {
      root.render(
        <PersonalAccessTokenSettings
          subjectId="member-1"
          initialPersonalAccessTokens={[
            {
              id: 'pat-1',
              createdAt: '2026-08-23T00:00:00.000Z',
              canRegenerate: true,
            },
          ]}
        />,
      );
    });

    await act(async () => viewProps().onRegenerate('pat-1'));

    expect(mocks.startPrivilegedReauthentication).toHaveBeenCalledWith(
      '/my/settings?resume_personal_access_token_action=1',
    );
    expect(sessionStorage.getItem('personal_access_token_continuation:member-1')).toContain('pat-1');
  });

  it('remounts the subject boundary so another Member cannot inherit secret state', async () => {
    mocks.createMy.mockResolvedValue({
      personalAccessToken: { id: 'pat-1', createdAt: '2026-08-23T00:00:00.000Z' },
      secret: 'member-1-secret',
    });
    await act(async () => viewProps().onCreate());
    const firstViewInstance = mocks.viewInstanceId;

    act(() => {
      root.render(
        <PersonalAccessTokenSettings
          subjectId="member-2"
          initialPersonalAccessTokens={[
            {
              id: 'pat-member-2',
              createdAt: '2026-08-23T00:00:00.000Z',
              canRegenerate: true,
            },
          ]}
        />,
      );
    });

    expect(mocks.viewInstanceId).not.toBe(firstViewInstance);
    expect(viewProps().secret).toBeNull();
    expect(viewProps().token).toMatchObject({ id: 'pat-member-2' });
  });
});
