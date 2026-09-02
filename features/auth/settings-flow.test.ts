import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('auth settings flow', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@/lib/public-runtime-config', () => ({
      getPublicAuthUrl: () => '/api/auth',
    }));
  });

  it('requests a browser settings flow with the exact same-origin return target', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'settings-flow',
          ui: {
            nodes: [
              {
                attributes: {
                  name: 'csrf_token',
                  value: 'csrf-token',
                },
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    const { requestSettingsFlow } = await import('./settings-flow');

    await expect(
      requestSettingsFlow({
        fetchFn: fetchMock,
        returnTo: '/my/security',
      }),
    ).resolves.toMatchObject({
      flowId: 'settings-flow',
      csrfToken: 'csrf-token',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/self-service/settings/browser?return_to=%2Fmy%2Fsecurity', {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
  });

  it('recognizes settings freshness from the HTTP boundary without provider error ids', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: 'Authentication freshness is required.' },
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    const { isSettingsFlowFreshnessError, submitSettingsPendingEmail } = await import('./settings-flow');

    const error = await submitSettingsPendingEmail({
      fetchFn: fetchMock,
      flow: {
        id: 'settings-flow',
        identity: {
          traits: {
            email: 'old@example.test',
            name: 'John Doe',
          },
        },
        ui: {
          nodes: [
            {
              attributes: {
                name: 'csrf_token',
                value: 'csrf-token',
              },
            },
          ],
        },
      },
      newEmail: 'new@example.test',
    }).catch((cause) => cause);
    expect(isSettingsFlowFreshnessError(error)).toBe(true);
  });

  it('submits the requested address as pending while preserving the canonical email and profile traits', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'settings-flow',
          state: 'success',
          identity: {
            traits: {
              email: 'old@example.test',
              pending_email: 'new@example.test',
              name: 'John Doe',
              preferred_locale: 'en',
            },
          },
          continue_with: [
            {
              action: 'show_verification_ui',
              flow: {
                id: '019f9b65-c856-7fb8-a66a-84d915a0303a',
                verifiable_address: 'new@example.test',
              },
            },
          ],
          ui: { nodes: [] },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    const { submitSettingsPendingEmail } = await import('./settings-flow');

    await submitSettingsPendingEmail({
      fetchFn: fetchMock,
      flow: {
        id: 'settings-flow',
        identity: {
          traits: {
            email: 'old@example.test',
            name: 'John Doe',
            preferred_locale: 'en',
          },
        },
        ui: {
          nodes: [
            {
              attributes: {
                name: 'csrf_token',
                value: 'csrf-token',
              },
            },
          ],
        },
      },
      newEmail: ' new@example.test ',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/self-service/settings?flow=settings-flow',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.body as string)).toEqual({
      method: 'profile',
      csrf_token: 'csrf-token',
      traits: {
        email: 'old@example.test',
        name: 'John Doe',
        preferred_locale: 'en',
        pending_email: 'new@example.test',
      },
    });
  });

  it('accepts only the matching canonical verification continuation', async () => {
    const { getSettingsVerificationContinuation } = await import('./settings-flow');
    const flow = {
      identity: {
        traits: {
          email: 'old@example.test',
          pending_email: 'New@Example.test',
        },
      },
      continue_with: [
        {
          action: 'show_verification_ui',
          flow: {
            id: '019f9b65-c856-7fb8-a66a-84d915a0303a',
            verifiable_address: 'new@example.test',
            url: 'https://untrusted.example/ignored',
          },
        },
      ],
    };

    expect(getSettingsVerificationContinuation(flow, 'new@example.test', 'old@example.test')).toEqual({
      flowId: '019f9b65-c856-7fb8-a66a-84d915a0303a',
      verifiableAddress: 'new@example.test',
    });
    expect(getSettingsVerificationContinuation(flow, 'other@example.test', 'old@example.test')).toBeNull();
    expect(
      getSettingsVerificationContinuation(
        {
          ...flow,
          continue_with: [
            {
              action: 'show_verification_ui',
              flow: {
                id: 'not-a-flow-id',
                verifiable_address: 'new@example.test',
              },
            },
          ],
        },
        'new@example.test',
        'old@example.test',
      ),
    ).toBeNull();
    expect(
      getSettingsVerificationContinuation(
        {
          ...flow,
          identity: {
            traits: {
              email: 'new@example.test',
              pending_email: 'new@example.test',
            },
          },
        },
        'new@example.test',
        'old@example.test',
      ),
    ).toBeNull();
  });

  it('clears only pending_email while preserving canonical and profile traits', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'settings-flow',
          state: 'success',
          identity: {
            traits: {
              email: 'old@example.test',
              name: 'John Doe',
              preferred_locale: 'en',
            },
          },
          ui: { nodes: [] },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    const { clearSettingsPendingEmail } = await import('./settings-flow');

    await clearSettingsPendingEmail({
      fetchFn: fetchMock,
      flow: {
        id: 'settings-flow',
        identity: {
          traits: {
            email: 'old@example.test',
            pending_email: 'new@example.test',
            name: 'John Doe',
            preferred_locale: 'en',
          },
        },
        ui: {
          nodes: [
            {
              attributes: {
                name: 'csrf_token',
                value: 'csrf-token',
              },
            },
          ],
        },
      },
    });

    expect(JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.body as string)).toEqual({
      method: 'profile',
      csrf_token: 'csrf-token',
      traits: {
        email: 'old@example.test',
        name: 'John Doe',
        preferred_locale: 'en',
      },
    });
  });
});
