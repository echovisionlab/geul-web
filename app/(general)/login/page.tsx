import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageLoader } from '@/features/site/PageLoader';
import { LoginContent } from '@/features/auth/LoginContent';
import { buildAuthPageMetadata } from '@/lib/i18n/auth-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return buildAuthPageMetadata('login', '/login');
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LoginContent />
    </Suspense>
  );
}
