import { redirect } from 'next/navigation';

import { MyProfilePageView } from '@/features/my/MyProfilePageView';
import { getMyProfile } from '@/lib/queries/my-account';
import { getSession } from '@/lib/utils/session.server';

export default async function MyProfilePage() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }
  const profile = await getMyProfile();
  if (!profile) {
    redirect('/');
  }
  const summary = profile.summary;
  if (!summary) {
    redirect('/');
  }

  return (
    <MyProfilePageView
      initialUser={{
        id: summary.id,
        nickname: summary.nickname,
        role: session.user.role,
        bio: profile.bio ?? null,
        website: profile.website ?? null,
        socialLinks: profile.socialLinks,
      }}
    />
  );
}
