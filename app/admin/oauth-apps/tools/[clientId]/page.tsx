import { notFound } from 'next/navigation';
import { OAuthConnectionDetail } from '@/features/admin/oauth-app/OAuthConnectionDetail';
import { listConnectedToolsAction } from '@/lib/actions/oauth-apps';
import { unwrapQueryResult } from '@/lib/api/query-result';

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export default async function ConnectedToolPage({ params }: PageProps) {
  const clientId = decodeURIComponent((await params).clientId);
  const tools = await listConnectedToolsAction().then(unwrapQueryResult);
  const connection = tools.find((tool) => tool.clientId === clientId);
  if (!connection) {
    notFound();
  }
  return <OAuthConnectionDetail connection={connection} />;
}
