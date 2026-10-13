import type { Metadata } from 'next';
import { confirmAccountDeletionAction } from '@/lib/actions/account';
import { buildAuthPageMetadata } from '@/lib/i18n/auth-metadata';
import { ConfirmDeletionPageView } from '@/features/account/ConfirmDeletionPageView';
export async function generateMetadata(): Promise<Metadata> {
  return buildAuthPageMetadata('confirmDeletion', '/account/deletion/confirm');
}

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function ConfirmDeletionPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const result = token ? await confirmAccountDeletionAction(token) : undefined;
  return <ConfirmDeletionPageView hasToken={Boolean(token)} result={result} />;
}
