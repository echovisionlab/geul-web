'use client';

import { StatusBadge } from '@/components/core/Badge';

export function UserNewsletterStatus({
  subscribed,
  labels,
}: {
  subscribed: boolean;
  labels: { subscribed: string; unsubscribed: string };
}) {
  return (
    <StatusBadge tone={subscribed ? 'positive' : 'neutral'} size="sm">
      {subscribed ? labels.subscribed : labels.unsubscribed}
    </StatusBadge>
  );
}
