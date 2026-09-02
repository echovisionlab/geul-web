import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Title } from '@mantine/core';
import { UserProfileView } from '@/features/user/UserProfileView';
import { UserPublishedPostsTable, UserPublishedPostsTableFallback } from '@/features/user/UserPublishedPostsTable';
import { getMemberMetadataDocument, getSiteMetadataDocument } from '@/lib/queries/metadata';
import { getUserProfileView } from '@/lib/queries/user';
import { getUserLocale } from '@/lib/utils/language.server';
import { buildUserOgMetadata } from '@/lib/utils/og';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { getSession } from '@/lib/utils/session.server';
import { joinUrl } from '@/lib/utils/url';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await getMemberMetadataDocument(id);
  const tProfile = await getTranslations('userProfile');

  if (!user) {
    const site = await getSiteMetadataDocument();
    return withNoIndex({
      title: tProfile('title'),
      description: tProfile('title'),
      alternates: {
        canonical: joinUrl(site.canonicalOrigin, `/user/${id}`),
      },
    });
  }

  return withNoIndex(
    buildUserOgMetadata({
      canonicalOrigin: user.site.canonicalOrigin,
      routePath: user.routePath,
      name: user.name ?? 'User Profile',
      bio: user.bio ?? undefined,
      avatarUrl: user.imageUrl,
      siteOgImageUrl: user.site.siteOgImageUrl,
      siteName: user.site.siteTitle || undefined,
    }),
  );
}

export default async function UserProfilePage({ params, searchParams }: Props) {
  const { id } = await params;
  const [session, uiLocale, tProfile, tCommonStates, resolvedSearchParams] = await Promise.all([
    getSession(),
    getUserLocale(),
    getTranslations('userProfile'),
    getTranslations('common.states'),
    searchParams,
  ]);
  const paramsForTable = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === 'string') {
      paramsForTable.set(key, value);
    }
  }

  const user = await getUserProfileView(session?.user?.id ?? null, session?.user?.role ?? null, id);

  if (!user) {
    notFound();
  }

  return (
    <>
      <UserProfileView
        user={{
          id: user.id,
          name: user.name,
          image: user.image,
          bio: user.bio,
          social_links: user.social_links,
          role: user.role,
          banned: user.banned,
          ban_reason: user.ban_reason,
          created_at: user.created_at,
          isAdmin: user.isAdmin,
          isSelf: user.isSelf,
          deleted: user.deleted,
        }}
      />

      <Title order={3} mt="lg">
        {tProfile('sections.publishedPosts')}
      </Title>

      <Suspense fallback={<UserPublishedPostsTableFallback message={tCommonStates('loading')} />}>
        <UserPublishedPostsTable memberId={id} requestedLocale={uiLocale} searchParams={paramsForTable} />
      </Suspense>
    </>
  );
}
