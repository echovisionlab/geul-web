'use client';

import { LayoutStack as DsLayoutStack, LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { useRouter } from 'next/navigation';

import { NicknameOnboarding } from '@/features/member/onboarding/NicknameOnboarding';
import { signOut, useSession } from '@/lib/auth/client';

export function NicknameOnboardingPage({ initialNickname, returnTo }: { initialNickname: string; returnTo: string }) {
  const router = useRouter();
  const { completeOnboarding } = useSession();

  return (
    <div style={{ minHeight: 'calc(100vh - 8rem)' }}>
      <DsLayoutInset space="md">
        <DsLayoutStack align="center" justify="center">
          <NicknameOnboarding
            initialNickname={initialNickname}
            onCompleted={(member) => {
              completeOnboarding(member);
              router.replace(returnTo);
              router.refresh();
            }}
            onLogout={signOut}
          />
        </DsLayoutStack>
      </DsLayoutInset>
    </div>
  );
}
