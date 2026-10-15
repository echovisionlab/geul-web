'use client';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutStack, LayoutInset } from '@/components/core/Layout';
import { Heading } from '@/components/core/Typography';
import { UserProfileView } from './UserProfileView';
export function UserProfilePageView({
  publishedPosts,
  ...profile
}: ComponentProps<typeof UserProfileView> & { publishedPosts: ReactNode }) {
  const t = useTranslations('userProfile');
  return (
    <LayoutStack gap="none">
      <UserProfileView {...profile} />
      <LayoutInset blockStart="lg">
        <Heading level={2} scale={3}>
          {t('sections.publishedPosts')}
        </Heading>
      </LayoutInset>
      {publishedPosts}
    </LayoutStack>
  );
}
