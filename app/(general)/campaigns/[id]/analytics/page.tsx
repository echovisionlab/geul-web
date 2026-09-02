import CampaignAnalyticsPage from '@/features/campaign/CampaignAnalyticsPage';
import { getCampaignAction } from '@/lib/actions/campaign';
import { renderPageRouteFallback } from '@/app/_shared/page-route-fallback';

export default async function CanonicalCampaignAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const campaign = await getCampaignAction(id);
  if (!campaign) {
    return renderPageRouteFallback(['campaigns', id, 'analytics'], query);
  }
  return <CampaignAnalyticsPage />;
}
