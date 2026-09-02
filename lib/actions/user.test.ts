import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALE_COOKIE_NAME } from '@/lib/i18n/locale';
import { updatePreferredLocaleAction } from './user-preference';

const mocks = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  cookies: vi.fn(),
  createMemberClient: vi.fn(),
  revalidatePath: vi.fn(),
  updateMyPreferences: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}));

vi.mock('@/lib/api/server-client', () => ({
  createMemberClient: mocks.createMemberClient,
}));

describe('updatePreferredLocaleAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({
      set: mocks.cookieSet,
    });
    mocks.createMemberClient.mockResolvedValue({
      updateMyPreferences: mocks.updateMyPreferences,
    });
  });

  it('rejects unsupported locales before calling the API', async () => {
    const result = await updatePreferredLocaleAction('xx');

    expect(result).toEqual({ error: 'Unsupported language' });
    expect(mocks.createMemberClient).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it('stores the normalized locale in the account and locale cookie', async () => {
    mocks.updateMyPreferences.mockResolvedValue({
      settings: { preferredLocale: 'ar' },
    });

    const result = await updatePreferredLocaleAction('ar-SA');

    expect(mocks.updateMyPreferences).toHaveBeenCalledWith({
      preferredLocale: 'ar',
    });
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      LOCALE_COOKIE_NAME,
      'ar',
      expect.objectContaining({
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(1, '/my/settings');
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, '/', 'layout');
    expect(result).toEqual({
      success: true,
      preferred_locale: 'ar',
    });
  });
});
