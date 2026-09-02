import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Title } from '@mantine/core';
import { ProfileForm } from '@/features/my/ProfileForm';
import { getMyProfile } from '@/lib/queries/my-account';
import { getSession } from '@/lib/utils/session.server';

export default async function MyProfilePage() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }
  const [tCommonLabels, profile] = await Promise.all([getTranslations('common.labels'), getMyProfile()]);
  if (!profile) {
    redirect('/');
  }
  const summary = profile.summary;
  if (!summary) {
    redirect('/');
  }

  return (
    <>
      <Title order={2} mb="md">
        {tCommonLabels('profile')}
      </Title>

      <ProfileForm
        initialUser={{
          id: summary.id,
          nickname: summary.nickname,
          role: session.user.role,
          bio: profile.bio ?? null,
          website: profile.website ?? null,
          socialLinks: profile.socialLinks,
        }}
      />
    </>
  );
}
