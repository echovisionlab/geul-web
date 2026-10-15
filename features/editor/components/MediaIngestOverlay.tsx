'use client';
import { ProcessingOverlay } from '@/components/core/LoadingSurface';

interface MediaIngestOverlayProps {
  title: string;
  accessibleLabel?: string;
  percentage?: number | null;
  detail?: string | null;
}

export function MediaIngestOverlay({ title, accessibleLabel = title, percentage, detail }: MediaIngestOverlayProps) {
  const normalizedPercentage =
    typeof percentage === 'number' && Number.isFinite(percentage)
      ? Math.max(0, Math.min(100, Math.round(percentage)))
      : null;

  return (
    <ProcessingOverlay
      role="status"
      aria-atomic="true"
      aria-label={accessibleLabel}
      progress={{
        value: normalizedPercentage,
        activity: 'pending',
        'aria-label': accessibleLabel,
        title,
        status:
          [detail, normalizedPercentage !== null ? `${normalizedPercentage}%` : undefined]
            .filter(Boolean)
            .join(' · ') || undefined,
      }}
    />
  );
}
