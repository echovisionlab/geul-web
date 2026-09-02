import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageLoader } from '@/features/site/PageLoader';
import { VerificationContent } from '@/features/auth/VerificationContent';
import { buildAuthPageMetadata } from '@/lib/i18n/auth-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return buildAuthPageMetadata('verification', '/verify');
}

export default function AuthVerifyPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <VerificationContent />
    </Suspense>
  );
}
