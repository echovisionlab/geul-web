export interface AuthenticatedLoginRedirectInput {
  hasSession: boolean;
  isPending: boolean;
  flowId: string | null;
  flowLoading: boolean;
  hasFlow: boolean;
  hasFlowError: boolean;
  isRefreshFlow: boolean;
}

export function shouldRedirectAuthenticatedLogin({
  hasSession,
  isPending,
  flowId,
  flowLoading,
  hasFlow,
  hasFlowError,
  isRefreshFlow,
}: AuthenticatedLoginRedirectInput): boolean {
  if (isPending || !hasSession) {
    return false;
  }

  if (!flowId) {
    return true;
  }

  if (flowLoading || (hasFlow && isRefreshFlow)) {
    return false;
  }

  if (hasFlowError) {
    return true;
  }

  return hasFlow;
}
