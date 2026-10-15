import type { Metadata } from 'next';
import { LoginErrorPageView } from '@/features/auth/LoginErrorPageView';
import { buildAuthPageMetadata } from '@/lib/i18n/auth-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return buildAuthPageMetadata('loginFailed', '/login/error');
}

export default async function LoginFailedPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <LoginErrorPageView error={id ? { id } : null} />;
}
