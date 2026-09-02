export const NICKNAME_ONBOARDING_PATH = '/onboarding/nickname';
export const DEFAULT_ONBOARDING_RETURN_TO = '/my/profile';

export function resolveOnboardingReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_ONBOARDING_RETURN_TO;
  }

  try {
    const parsed = new URL(value, 'https://app.local');
    if (parsed.origin !== 'https://app.local' || parsed.pathname.startsWith('/onboarding')) {
      return DEFAULT_ONBOARDING_RETURN_TO;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_ONBOARDING_RETURN_TO;
  }
}

export function buildNicknameOnboardingHref(returnTo: string | null | undefined): string {
  const safeReturnTo = resolveOnboardingReturnTo(returnTo);
  return `${NICKNAME_ONBOARDING_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function resolveNicknameOnboardingInitialValue(nicknameSuggestion: string | null): string {
  return nicknameSuggestion?.trim() ?? '';
}

export async function loadAfterOnboardingGate<TSession extends { onboarded: boolean }, TBootstrap>({
  pathname,
  pathWithSearch,
  loadSession,
  loadBootstrap,
}: {
  pathname: string;
  pathWithSearch: string;
  loadSession: () => Promise<TSession | null>;
  loadBootstrap: () => Promise<TBootstrap>;
}): Promise<
  | { kind: 'redirect'; redirectHref: string; session: TSession }
  | { kind: 'ready'; session: TSession | null; bootstrap: TBootstrap }
> {
  const session = await loadSession();
  if (session && !session.onboarded && pathname !== NICKNAME_ONBOARDING_PATH) {
    return { kind: 'redirect', redirectHref: buildNicknameOnboardingHref(pathWithSearch), session };
  }
  return { kind: 'ready', session, bootstrap: await loadBootstrap() };
}
