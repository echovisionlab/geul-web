import { notFound } from 'next/navigation';
import CampaignEditPage from '@/features/campaign/CampaignEditPage';
import { getCampaignAction } from '@/lib/actions/campaign';
import { renderPageRouteFallback } from '@/app/_shared/page-route-fallback';

export default async function CanonicalCampaignEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const campaign = await getCampaignAction(id);
  if (!campaign) {
    return renderPageRouteFallback(['campaigns', id], query);
  }
  const edit = Array.isArray(query.edit) ? query.edit[0] : query.edit;
  if (edit !== 'true') {
    notFound();
  }
  return <CampaignEditPage />;
}
