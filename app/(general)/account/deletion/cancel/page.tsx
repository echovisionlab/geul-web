import type { Metadata } from 'next';
import { cancelAccountDeletionAction } from '@/lib/actions/account';
import { buildAuthPageMetadata } from '@/lib/i18n/auth-metadata';
import { CancelDeletionPageView } from '@/features/account/CancelDeletionPageView';
export async function generateMetadata(): Promise<Metadata> {
  return buildAuthPageMetadata('cancelDeletion', '/account/deletion/cancel');
}

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function CancelDeletionPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const result = token ? await cancelAccountDeletionAction(token) : undefined;
  return <CancelDeletionPageView hasToken={Boolean(token)} result={result} />;
}
