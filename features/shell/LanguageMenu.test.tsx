// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@/test/render';
import { LocaleProvider } from '@/lib/providers/LocaleProvider';
import { getSupportedLocaleOptions } from '@/lib/i18n/locale';
import { LanguageMenu } from './LanguageMenu';
const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
  update: vi.fn(),
  session: { data: null as null | { user: { id: string } }, isPending: false },
}));
vi.mock('next/navigation', () => ({ useRouter: () => mocks }));
vi.mock('@/lib/auth/client', () => ({ useSession: () => mocks.session }));
vi.mock('@/lib/actions/user-preference', () => ({ updatePreferredLocaleAction: mocks.update }));
const dutch = getSupportedLocaleOptions().find((option) => option.value === 'nl')!.label;
function setup() {
  return render(
    <LocaleProvider locale="en">
      <LanguageMenu variant="text" />
    </LocaleProvider>,
  );
}
beforeEach(() => {
  mocks.session = { data: null, isPending: false };
  mocks.refresh.mockReset();
  mocks.replace.mockReset();
  mocks.update.mockReset();
  window.history.replaceState(null, '', '/terms');
});
describe('LanguageMenu', () => {
  it('preserves the visible language in the name and describes its purpose', () => {
    setup();
    const trigger = screen.getByRole('button', { name: 'English' });
    expect(trigger).toHaveTextContent('English');
    expect(trigger).toHaveAccessibleDescription('Change language');
    expect(trigger).toHaveAttribute('aria-haspopup', expect.stringMatching(/^(true|menu)$/));
  });
  it.each([false, true])('stays pending through a slow locale navigation (pinned=%s)', async (pinned) => {
    window.history.replaceState(null, '', pinned ? '/terms?lang=ko&tab=1#scope' : '/terms');
    let finish!: () => void;
    const navigation = new Promise<void>((resolve) => {
      finish = resolve;
    });
    (pinned ? mocks.replace : mocks.refresh).mockReturnValue(navigation);
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'English' }));
    await user.click(await screen.findByRole('menuitem', { name: dutch }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-busy', 'true'));
    if (pinned) {
      expect(mocks.replace).toHaveBeenCalledWith('/terms?tab=1#scope', { scroll: false });
      expect(mocks.refresh).not.toHaveBeenCalled();
    } else {
      expect(mocks.refresh).toHaveBeenCalledOnce();
    }
    expect(document.cookie).toContain('locale=nl');
    await act(async () => finish());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'English' })).not.toHaveAttribute('aria-busy', 'true'),
    );
  });
  it('keeps preference persistence pending and ignores its response after unmount', async () => {
    let finish!: (result: { success: boolean; preferred_locale: string }) => void;
    mocks.session.data = { user: { id: 'user' } };
    mocks.update.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { user, unmount } = setup();
    await user.click(screen.getByRole('button', { name: 'English' }));
    await user.click(await screen.findByRole('menuitem', { name: dutch }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-busy', 'true'));
    unmount();
    await act(async () => finish({ success: true, preferred_locale: 'nl' }));
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it('recovers from a failed signed-in preference update without navigating', async () => {
    mocks.session.data = { user: { id: 'user' } };
    mocks.update.mockResolvedValue({ success: false, error: 'Cannot save preference' });
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'English' }));
    await user.click(await screen.findByRole('menuitem', { name: dutch }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'English' })).not.toHaveAttribute('aria-busy', 'true'),
    );
    expect(mocks.update).toHaveBeenCalledWith('nl');
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('disables language changes while the session is unresolved', () => {
    mocks.session.isPending = true;
    setup();
    expect(screen.getByRole('button', { name: 'English' })).toBeDisabled();
  });
});
