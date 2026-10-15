'use client';
import type { ComponentProps } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutStack } from '@/components/core/Layout';
import { Heading } from '@/components/core/Typography';
import { ProfileForm } from './ProfileForm';
export function MyProfilePageView(props: ComponentProps<typeof ProfileForm>) {
  const t = useTranslations('common.labels');
  return (
    <LayoutStack gap="md">
      <Heading level={1} scale={2}>
        {t('profile')}
      </Heading>
      <ProfileForm {...props} />
    </LayoutStack>
  );
}
