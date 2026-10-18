import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccountClient, createPublicNewsletterClient } from '@/lib/api/server-client';
import {
  setCurrentUserNewsletterSubscriptionAction,
  unsubscribeNewsletterAction,
  unsubscribeUserFromNewsletterAction,
} from './newsletter';

const logFailure = vi.hoisted(() => vi.fn());
vi.mock('@/lib/logging/logger', () => ({ logServerFailure: logFailure }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({
  createPublicNewsletterClient: vi.fn(),
  createAccountClient: vi.fn(),
}));

describe('newsletter actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs the original unsubscribe failure before returning the same result', async () => {
    const error = new Error('upstream unavailable', { cause: new Error('connection refused') });
    vi.mocked(createPublicNewsletterClient).mockReturnValue({
      unsubscribe: vi.fn().mockRejectedValue(error),
    } as never);
    await expect(unsubscribeNewsletterAction('signed-token')).resolves.toEqual({
      success: false,
      message: 'upstream unavailable',
    });
    expect(logFailure).toHaveBeenCalledWith('newsletter-actions', 'unsubscribeNewsletterAction', error, [
      'signed-token',
    ]);
  });

  it('uses only the signed token for public unsubscribe', async () => {
    const unsubscribe = vi.fn().mockResolvedValue({});
    vi.mocked(createPublicNewsletterClient).mockReturnValue({ unsubscribe } as never);

    await expect(unsubscribeNewsletterAction(' signed-token ')).resolves.toMatchObject({ success: true });
    expect(unsubscribe).toHaveBeenCalledWith({ token: 'signed-token' });
  });

  it('rejects public unsubscribe without a token before calling the service', async () => {
    await expect(unsubscribeNewsletterAction(' ')).resolves.toMatchObject({ success: false });
    expect(createPublicNewsletterClient).not.toHaveBeenCalled();
  });

  it('sets the current identity subscription without accepting an email address', async () => {
    const setMyNewsletterSubscription = vi.fn().mockResolvedValue({});
    vi.mocked(createAccountClient).mockResolvedValue({ setMyNewsletterSubscription } as never);

    await expect(setCurrentUserNewsletterSubscriptionAction(true)).resolves.toMatchObject({ success: true });
    expect(setMyNewsletterSubscription).toHaveBeenCalledWith({ subscribed: true });
  });

  it('exposes only admin unsubscribe for another user', async () => {
    const unsubscribeAccountFromNewsletter = vi.fn().mockResolvedValue({});
    vi.mocked(createAccountClient).mockResolvedValue({ unsubscribeAccountFromNewsletter } as never);

    await expect(unsubscribeUserFromNewsletterAction(' user-1 ')).resolves.toMatchObject({ success: true });
    expect(unsubscribeAccountFromNewsletter).toHaveBeenCalledWith({ memberId: 'user-1' });
  });
});
