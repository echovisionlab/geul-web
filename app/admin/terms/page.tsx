import { listTermsVersions } from '@/lib/queries/terms';
import { TermsListClient } from './TermsListClient';

export default async function AdminTermsPage() {
  const versions = await listTermsVersions();

  return <TermsListClient initialVersions={versions} />;
}
