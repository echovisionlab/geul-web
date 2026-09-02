import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COOKIE_CONSENT_VERSION } from '@/lib/cookie-consent';
import { persistCurrentUserCookieConsentAction } from './cookie-consent';

const mocks = vi.hoisted(() => ({
  createMemberClient: vi.fn(),
}));

const memberClient = vi.hoisted(() => ({
  updateMyPreferences: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createMemberClient: mocks.createMemberClient,
}));

describe('cookie consent actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createMemberClient.mockResolvedValue(memberClient);
    memberClient.updateMyPreferences.mockResolvedValue({
      settings: {
        cookieConsent: {
          essential: true,
          analytics: true,
          version: COOKIE_CONSENT_VERSION,
          source: 'banner',
          updatedAt: timestampFromDate(new Date('2026-01-02T03:04:05Z')),
        },
      },
    });
  });

  it('persists current-user consent through the user service', async () => {
    await expect(persistCurrentUserCookieConsentAction({ analytics: true, source: 'banner' })).resolves.toEqual({
      success: true,
      persisted: true,
      consent: {
        essential: true,
        analytics: true,
        version: COOKIE_CONSENT_VERSION,
        source: 'banner',
        updated_at: '2026-01-02T03:04:05.000Z',
      },
    });

    expect(memberClient.updateMyPreferences).toHaveBeenCalledWith({
      cookieConsent: {
        analytics: true,
        version: COOKIE_CONSENT_VERSION,
        source: 'banner',
      },
    });
  });

  it('uses the browser-cookie path for unauthenticated users', async () => {
    memberClient.updateMyPreferences.mockRejectedValueOnce(
      new ConnectError('access credentials are invalid', Code.Unauthenticated),
    );

    await expect(persistCurrentUserCookieConsentAction({ analytics: false, version: 3 })).resolves.toEqual({
      success: true,
      persisted: false,
    });
  });

  it('reports service responses that omit consent details', async () => {
    memberClient.updateMyPreferences.mockResolvedValueOnce({});

    await expect(persistCurrentUserCookieConsentAction({ analytics: false })).resolves.toEqual({
      success: false,
      persisted: false,
      error: 'Missing consent response from server',
    });
  });
});
