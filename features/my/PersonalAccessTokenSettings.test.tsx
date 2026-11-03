// @vitest-environment jsdom
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@/test/render';
import { PersonalAccessTokenSettings } from './PersonalAccessTokenSettings';
import { rememberPersonalAccessTokenContinuation } from './personal-access-token-reauthentication';
const mocks = vi.hoisted(() => ({
  createAccount: vi.fn(),
  createMy: vi.fn(),
  deleteAccount: vi.fn(),
  deleteMy: vi.fn(),
  regenerateAccount: vi.fn(),
  regenerateMy: vi.fn(),
  searchParams: new URLSearchParams(),
  startPrivilegedReauthentication: vi.fn(),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/my/settings', useSearchParams: () => mocks.searchParams }));
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
const token = { id: 'pat-1', createdAt: '2026-08-23T00:00:00.000Z', canRegenerate: true };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.searchParams = new URLSearchParams();
  sessionStorage.clear();
});
describe('PersonalAccessTokenSettings controller', () => {
  it('exposes the secret only in the one-time surface while retaining token metadata', async () => {
    mocks.createMy.mockResolvedValue({ personalAccessToken: token, secret: 'one-time-secret' });
    const { user } = render(<PersonalAccessTokenSettings subjectId="member-1" initialPersonalAccessTokens={[]} />);
    await user.click(screen.getByRole('button', { name: 'Create' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('one-time-secret')).toBeVisible();
    await user.click(within(dialog).getAllByRole('button', { name: 'Close' })[0]);
    expect(screen.queryByText('one-time-secret')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeVisible();
    expect(mocks.createMy).toHaveBeenCalledWith();
  });
  it('uses the admin target actions with the same token controls', async () => {
    mocks.createAccount.mockResolvedValue({ personalAccessToken: token, secret: 'admin-created-secret' });
    const { user } = render(
      <PersonalAccessTokenSettings subjectId="member-2" mode="admin" initialPersonalAccessTokens={[]} />,
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('admin-created-secret')).toBeVisible();
    expect(mocks.createAccount).toHaveBeenCalledWith('member-2');
  });
  it('preserves regeneration intent across the freshness redirect', async () => {
    mocks.regenerateMy.mockResolvedValue({ error: 'reauth_required' });
    const { user } = render(<PersonalAccessTokenSettings subjectId="member-1" initialPersonalAccessTokens={[token]} />);
    await user.click(screen.getByRole('button', { name: 'Regenerate' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Regenerate' }));
    expect(mocks.startPrivilegedReauthentication).toHaveBeenCalledWith(
      '/my/settings?resume_personal_access_token_action=1',
    );
    expect(sessionStorage.getItem('personal_access_token_continuation:member-1')).toContain('pat-1');
  });
  it('clears the one-time secret when the member changes', async () => {
    mocks.createMy.mockResolvedValue({ personalAccessToken: token, secret: 'member-1-secret' });
    const { user, rerender } = render(
      <PersonalAccessTokenSettings subjectId="member-1" initialPersonalAccessTokens={[]} />,
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await screen.findByText('member-1-secret');
    rerender(
      <PersonalAccessTokenSettings
        subjectId="member-2"
        initialPersonalAccessTokens={[{ ...token, id: 'pat-member-2' }]}
      />,
    );
    expect(screen.queryByText('member-1-secret')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeVisible();
  });
  it('shows resumed deletion on its row and ignores completion after a member change', async () => {
    let finish!: (result: { deleted: boolean }) => void;
    mocks.deleteMy.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    rememberPersonalAccessTokenContinuation({ action: 'delete', id: token.id }, 'member-1');
    mocks.searchParams = new URLSearchParams('resume_personal_access_token_action=1');
    const { rerender } = render(
      <PersonalAccessTokenSettings subjectId="member-1" initialPersonalAccessTokens={[token]} />,
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeDisabled();
    mocks.searchParams = new URLSearchParams();
    rerender(<PersonalAccessTokenSettings subjectId="member-2" initialPersonalAccessTokens={[token]} />);
    await act(async () => finish({ deleted: true }));
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeEnabled();
    expect(mocks.deleteMy).toHaveBeenCalledTimes(1);
  });
});
