import { beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

const settingsFlow = {
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
          value: 'settings-csrf',
        },
      },
    ],
  },
};

describe('canonical email verification', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@/lib/public-runtime-config', () => ({
      getPublicAuthUrl: () => '/api/auth',
    }));
  });

  it('preflights, preserves the canonical email, and accepts only the matching continuation', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(settingsFlow))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'settings-flow',
          state: 'success',
          identity: {
            traits: {
              email: 'old@example.test',
              pending_email: 'new@example.test',
              name: 'John Doe',
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
          ui: { nodes: [] },
        }),
      );
    const preflight = vi.fn().mockResolvedValue({ success: true, message: 'accepted' });
    const { beginCanonicalEmailVerification } = await import('./canonical-email-verification');

    await expect(
      beginCanonicalEmailVerification({
        fetchFn: fetchMock,
        newEmail: ' new@example.test ',
        preflight,
      }),
    ).resolves.toEqual({
      kind: 'verification_started',
      flowId: '019f9b65-c856-7fb8-a66a-84d915a0303a',
      verifiableAddress: 'new@example.test',
    });
    expect(preflight).toHaveBeenCalledWith('new@example.test');
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/self-service/settings?flow=settings-flow', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'profile',
        csrf_token: 'settings-csrf',
        traits: {
          email: 'old@example.test',
          name: 'John Doe',
          pending_email: 'new@example.test',
        },
      }),
    });
  });

  it('stops before settings when the stateless preflight rejects the address', async () => {
    const fetchMock = vi.fn();
    const preflight = vi.fn().mockResolvedValue({
      success: false,
      message: 'This email already exists',
    });
    const { beginCanonicalEmailVerification } = await import('./canonical-email-verification');

    await expect(
      beginCanonicalEmailVerification({
        fetchFn: fetchMock,
        newEmail: 'taken@example.test',
        preflight,
      }),
    ).resolves.toEqual({
      kind: 'preflight_rejected',
      message: 'This email already exists',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a continuation that is not bound to the pending email', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(settingsFlow))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'settings-flow',
          state: 'success',
          identity: {
            traits: {
              email: 'old@example.test',
              pending_email: 'other@example.test',
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
      );
    const { beginCanonicalEmailVerification } = await import('./canonical-email-verification');

    await expect(
      beginCanonicalEmailVerification({
        fetchFn: fetchMock,
        newEmail: 'new@example.test',
        preflight: async () => ({ success: true, message: 'accepted' }),
      }),
    ).resolves.toEqual({ kind: 'failed' });
  });

  it('classifies settings session freshness by HTTP status instead of provider error ids', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(settingsFlow))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: { message: 'Authentication freshness is required.' },
          },
          { status: 403 },
        ),
      );
    const { beginCanonicalEmailVerification } = await import('./canonical-email-verification');

    await expect(
      beginCanonicalEmailVerification({
        fetchFn: fetchMock,
        newEmail: 'new@example.test',
        preflight: async () => ({ success: true, message: 'accepted' }),
      }),
    ).resolves.toEqual({ kind: 'reauth_required' });
  });

  it('clears an abandoned pending address through a fresh flow before restaging it through another fresh flow', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ...settingsFlow,
          identity: {
            traits: {
              email: 'old@example.test',
              pending_email: 'new@example.test',
              name: 'John Doe',
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'clear-flow',
          state: 'success',
          identity: {
            traits: {
              email: 'old@example.test',
              name: 'John Doe',
            },
          },
          ui: { nodes: [] },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ...settingsFlow,
          id: 'restage-flow',
          ui: {
            nodes: [
              {
                attributes: {
                  name: 'csrf_token',
                  value: 'restage-csrf',
                },
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'restage-flow',
          state: 'success',
          identity: {
            traits: {
              email: 'old@example.test',
              pending_email: 'new@example.test',
              name: 'John Doe',
            },
          },
          continue_with: [
            {
              action: 'show_verification_ui',
              flow: {
                id: '019f9b65-c856-7fb8-a66a-84d915a0303d',
                verifiable_address: 'new@example.test',
              },
            },
          ],
          ui: { nodes: [] },
        }),
      );
    const preflight = vi.fn().mockResolvedValue({ success: true, message: 'accepted' });
    const { restartCanonicalEmailVerification } = await import('./canonical-email-verification');

    await expect(
      restartCanonicalEmailVerification({
        fetchFn: fetchMock,
        newEmail: 'new@example.test',
        preflight,
      }),
    ).resolves.toEqual({
      kind: 'verification_started',
      flowId: '019f9b65-c856-7fb8-a66a-84d915a0303d',
      verifiableAddress: 'new@example.test',
    });
    expect(preflight).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit).body as string)).toEqual({
      method: 'profile',
      csrf_token: 'settings-csrf',
      traits: {
        email: 'old@example.test',
        name: 'John Doe',
      },
    });
    expect(JSON.parse((fetchMock.mock.calls[3]?.[1] as RequestInit).body as string)).toMatchObject({
      traits: {
        email: 'old@example.test',
        name: 'John Doe',
        pending_email: 'new@example.test',
      },
    });
  });

  it('accepts only a validated replacement verification flow id', async () => {
    const { getReplacementVerificationFlowId } = await import('./canonical-email-verification');

    expect(
      getReplacementVerificationFlowId({
        use_flow_id: '019f9b65-c856-7fb8-a66a-84d915a0303a',
      }),
    ).toBe('019f9b65-c856-7fb8-a66a-84d915a0303a');
    expect(
      getReplacementVerificationFlowId({
        use_flow_id: 'not-a-flow-id',
      }),
    ).toBeNull();
    expect(
      getReplacementVerificationFlowId({
        error: { id: 'provider-internal-value-is-ignored' },
        use_flow_id: '019f9b65-c856-7fb8-a66a-84d915a0303a',
      }),
    ).toBe('019f9b65-c856-7fb8-a66a-84d915a0303a');
  });

  it('derives applied, applying, proof-pending, and conflict from the current identity', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          identity: {
            traits: {
              email: 'New@Example.test',
              name: 'John Doe',
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          identity: {
            traits: {
              email: 'old@example.test',
              pending_email: 'new@example.test',
            },
            verifiable_addresses: [{ via: 'email', value: 'new@example.test', verified: true }],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          identity: {
            traits: {
              email: 'old@example.test',
              pending_email: 'new@example.test',
            },
            verifiable_addresses: [{ via: 'email', value: 'new@example.test', verified: false }],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          identity: {
            traits: { email: 'old@example.test' },
          },
        }),
      );
    const { observeCanonicalEmailChange } = await import('./canonical-email-verification');

    await expect(
      observeCanonicalEmailChange({
        fetchFn: fetchMock,
        targetEmail: 'new@example.test',
      }),
    ).resolves.toEqual({ kind: 'applied', email: 'new@example.test' });
    await expect(
      observeCanonicalEmailChange({
        fetchFn: fetchMock,
        targetEmail: 'new@example.test',
      }),
    ).resolves.toEqual({ kind: 'applying', email: 'new@example.test' });
    await expect(observeCanonicalEmailChange({ fetchFn: fetchMock, targetEmail: 'new@example.test' })).resolves.toEqual(
      { kind: 'proof_pending', email: 'new@example.test' },
    );
    await expect(observeCanonicalEmailChange({ fetchFn: fetchMock, targetEmail: 'new@example.test' })).resolves.toEqual(
      { kind: 'conflict', email: 'new@example.test' },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/auth/sessions/whoami', {
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
  });
});
