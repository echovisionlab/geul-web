import { listPrivacyVersions } from '@/lib/queries/privacy';
import { PrivacyListClient } from './PrivacyListClient';

export default async function AdminPrivacyPage() {
  const versions = await listPrivacyVersions();

  return <PrivacyListClient initialVersions={versions} />;
}
