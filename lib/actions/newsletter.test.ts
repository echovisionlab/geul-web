import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicNewsletterClient } from '@/lib/api/server-client';
import { unsubscribeNewsletterAction } from './newsletter';

const logFailure = vi.hoisted(() => vi.fn());
vi.mock('@/lib/logging/logger', () => ({ logServerFailure: logFailure }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({
  createPublicNewsletterClient: vi.fn(),
  createAccountClient: vi.fn(),
}));

describe('newsletter actions', () => {
  beforeEach(() => vi.clearAllMocks());

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
});
