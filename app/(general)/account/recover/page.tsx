import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageLoader } from '@/features/site/PageLoader';
import { RecoverAccountContent } from '@/features/account/RecoverAccountContent';
import { buildAuthPageMetadata } from '@/lib/i18n/auth-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return buildAuthPageMetadata('recoverAccount', '/account/recover');
}

export default function RecoverAccountPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RecoverAccountContent />
    </Suspense>
  );
}
