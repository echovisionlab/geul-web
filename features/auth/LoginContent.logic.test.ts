import { describe, expect, it } from 'vitest';
import { shouldRedirectAuthenticatedLogin } from './login-flow-guards';

describe('shouldRedirectAuthenticatedLogin', () => {
  it('keeps refresh flows open for already-authenticated sessions', () => {
    expect(
      shouldRedirectAuthenticatedLogin({
        hasSession: true,
        isPending: false,
        flowId: 'flow-123',
        flowLoading: false,
        hasFlow: true,
        hasFlowError: false,
        isRefreshFlow: true,
      }),
    ).toBe(false);
  });

  it('falls back from an unavailable ordinary flow for an already-authenticated session', () => {
    expect(
      shouldRedirectAuthenticatedLogin({
        hasSession: true,
        isPending: false,
        flowId: 'unavailable-flow',
        flowLoading: false,
        hasFlow: false,
        hasFlowError: true,
        isRefreshFlow: false,
      }),
    ).toBe(true);
  });

  it('redirects authenticated users away from ordinary login flows', () => {
    expect(
      shouldRedirectAuthenticatedLogin({
        hasSession: true,
        isPending: false,
        flowId: 'flow-123',
        flowLoading: false,
        hasFlow: true,
        hasFlowError: false,
        isRefreshFlow: false,
      }),
    ).toBe(true);
  });

  it('does not redirect while the login flow is still loading', () => {
    expect(
      shouldRedirectAuthenticatedLogin({
        hasSession: true,
        isPending: false,
        flowId: 'flow-123',
        flowLoading: true,
        hasFlow: false,
        hasFlowError: false,
        isRefreshFlow: false,
      }),
    ).toBe(false);
  });
});
