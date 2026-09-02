import { describe, expect, it, vi } from 'vitest';
import {
  buildNicknameOnboardingHref,
  DEFAULT_ONBOARDING_RETURN_TO,
  loadAfterOnboardingGate,
  resolveNicknameOnboardingInitialValue,
  resolveOnboardingReturnTo,
} from './onboarding-redirect';

describe('nickname onboarding redirect', () => {
  it('preserves an exact same-origin path with its query', () => {
    expect(resolveOnboardingReturnTo('/posts/123?edit=true&locale=ko')).toBe('/posts/123?edit=true&locale=ko');
    expect(buildNicknameOnboardingHref('/posts/123?edit=true&locale=ko')).toBe(
      '/onboarding/nickname?return_to=%2Fposts%2F123%3Fedit%3Dtrue%26locale%3Dko',
    );
  });

  it('rejects external, protocol-relative, and onboarding loops', () => {
    expect(resolveOnboardingReturnTo('https://evil.example/')).toBe(DEFAULT_ONBOARDING_RETURN_TO);
    expect(resolveOnboardingReturnTo('//evil.example/')).toBe(DEFAULT_ONBOARDING_RETURN_TO);
    expect(resolveOnboardingReturnTo('/onboarding/nickname?return_to=/admin')).toBe(DEFAULT_ONBOARDING_RETURN_TO);
  });

  it('uses only the ephemeral provider suggestion as the onboarding input value', () => {
    expect(resolveNicknameOnboardingInitialValue('  SuggestedName  ')).toBe('SuggestedName');
    expect(resolveNicknameOnboardingInitialValue(null)).toBe('');
  });

  it('redirects an incomplete Member before loading unrelated root bootstrap data', async () => {
    const loadBootstrap = vi.fn().mockResolvedValue('bootstrap');
    const result = await loadAfterOnboardingGate({
      pathname: '/posts/123',
      pathWithSearch: '/posts/123?edit=true&locale=ko',
      loadSession: async () => ({ onboarded: false }),
      loadBootstrap,
    });

    expect(result).toEqual({
      kind: 'redirect',
      redirectHref: '/onboarding/nickname?return_to=%2Fposts%2F123%3Fedit%3Dtrue%26locale%3Dko',
      session: { onboarded: false },
    });
    expect(loadBootstrap).not.toHaveBeenCalled();
  });

  it('keeps root bootstrap data available on the onboarding route', async () => {
    const loadBootstrap = vi.fn().mockResolvedValue('bootstrap');
    const result = await loadAfterOnboardingGate({
      pathname: '/onboarding/nickname',
      pathWithSearch: '/onboarding/nickname',
      loadSession: async () => ({ onboarded: false }),
      loadBootstrap,
    });

    expect(result).toEqual({ kind: 'ready', session: { onboarded: false }, bootstrap: 'bootstrap' });
    expect(loadBootstrap).toHaveBeenCalledOnce();
  });
});
