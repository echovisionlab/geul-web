import { redirect } from 'next/navigation';
import { NicknameOnboardingPage } from './NicknameOnboardingPage';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { resolveNicknameOnboardingInitialValue, resolveOnboardingReturnTo } from '@/lib/auth/onboarding-redirect';
import { getSession } from '@/lib/utils/session.server';

export default async function NicknameOnboardingRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const returnTo = resolveOnboardingReturnTo(typeof params.return_to === 'string' ? params.return_to : undefined);
  const session = await getSession();

  if (!session?.user) {
    redirect(buildLoginRedirectHref(`/onboarding/nickname?return_to=${encodeURIComponent(returnTo)}`));
  }
  if (session.onboarded) {
    redirect(returnTo);
  }

  return (
    <NicknameOnboardingPage
      initialNickname={resolveNicknameOnboardingInitialValue(session.nickname_suggestion)}
      returnTo={returnTo}
    />
  );
}
