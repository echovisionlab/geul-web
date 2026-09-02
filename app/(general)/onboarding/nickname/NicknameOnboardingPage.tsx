'use client';

import { useRouter } from 'next/navigation';
import { Center } from '@mantine/core';
import { NicknameOnboarding } from '@/features/member/onboarding/NicknameOnboarding';
import { signOut, useSession } from '@/lib/auth/client';

export function NicknameOnboardingPage({ initialNickname, returnTo }: { initialNickname: string; returnTo: string }) {
  const router = useRouter();
  const { completeOnboarding } = useSession();

  return (
    <Center mih="calc(100vh - 8rem)" p="md">
      <NicknameOnboarding
        initialNickname={initialNickname}
        onCompleted={(member) => {
          completeOnboarding(member);
          router.replace(returnTo);
          router.refresh();
        }}
        onLogout={signOut}
      />
    </Center>
  );
}
