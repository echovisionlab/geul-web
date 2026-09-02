import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkFormAccessAction } from '@/lib/actions/form';
import { accessFormShareAction } from './form-share-access';

vi.mock('@/lib/actions/form', () => ({
  checkFormAccessAction: vi.fn(),
}));

const checkAccess = vi.mocked(checkFormAccessAction);

function request(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

describe('accessFormShareAction', () => {
  beforeEach(() => {
    checkAccess.mockReset();
  });

  it('keeps the ShareLink password separate and grants the exact dashboard target', async () => {
    checkAccess.mockResolvedValue({ accessible: true, form: null });

    await expect(
      accessFormShareAction(
        {},
        request({
          token: 'share-token',
          idOrSlug: 'contact',
          requestedLocale: 'ko',
          password: 'secret',
          target: 'dashboard',
        }),
      ),
    ).resolves.toEqual({ granted: true });
    expect(checkAccess).toHaveBeenCalledWith({
      slug: 'contact',
      context: 'url',
      target: 'dashboard',
      shareToken: 'share-token',
      sharePassword: 'secret',
      requestedLocale: 'ko',
    });
  });

  it('does not expose why a protected link proof failed', async () => {
    checkAccess.mockResolvedValue({ accessible: false, reason: 'form_not_found', form: null });

    await expect(
      accessFormShareAction(
        {},
        request({
          token: 'share-token',
          idOrSlug: 'contact',
          requestedLocale: 'en',
          password: 'wrong',
          target: 'form',
        }),
      ),
    ).resolves.toEqual({ error: 'incorrect_password' });
  });
});
