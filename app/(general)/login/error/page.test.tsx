import { describe, expect, it, vi } from 'vitest';
import ko from '@/messages/ko.json';
import { ErrorPageView } from '@/features/application-error/ErrorPageView';
import LoginFailedPage from './page';

vi.mock('@/lib/i18n/auth-metadata', () => ({ buildAuthPageMetadata: vi.fn() }));
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => (key: string) => {
    let value: unknown = ko;
    for (const part of `${namespace}.${key}`.split('.')) {
      value = (value as Record<string, unknown>)[part];
    }
    return String(value);
  },
}));

describe('login error page integration', () => {
  it.each([
    ['account_pending_deletion', '403'],
    ['account_banned', '403'],
    ['session_inactive', '401'],
    ['security_csrf_violation', '403'],
    ['unrecognized_error', '401'],
    [undefined, '500'],
  ])('uses the shared page and status for %s', async (id, code) => {
    const page = await LoginFailedPage({ searchParams: Promise.resolve({ id }) });
    expect(page.type).toBe(ErrorPageView);
    expect(page.props.code).toBe(code);
    expect(page.props.actions.map((action: { href: string }) => action.href)).toContain('/login');
    expect(page.props.actions.map((action: { href: string }) => action.href)).toContain('/');
  });

  it('retains account recovery and its explanation after changing the presentation', async () => {
    const page = await LoginFailedPage({ searchParams: Promise.resolve({ id: 'account_pending_deletion' }) });
    expect(page.props.description).toBe(ko.auth.loginFailed.states.accountPendingDeletion.message);
    expect(page.props.actions[0]).toEqual({ label: ko.common.actions.recoverAccount, href: '/account/recover' });
  });
});
