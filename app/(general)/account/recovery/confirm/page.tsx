import type { Metadata } from 'next';
import { confirmAccountRecoveryAction } from '@/lib/actions/account';
import { buildAuthPageMetadata } from '@/lib/i18n/auth-metadata';
import { ConfirmRecoveryPageView } from '@/features/account/ConfirmRecoveryPageView';
export async function generateMetadata(): Promise<Metadata> {
  return buildAuthPageMetadata('confirmRecovery', '/account/recovery/confirm');
}

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ConfirmRecoveryPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const result = token ? await confirmAccountRecoveryAction(token) : undefined;
  return <ConfirmRecoveryPageView hasToken={Boolean(token)} result={result} />;
}
