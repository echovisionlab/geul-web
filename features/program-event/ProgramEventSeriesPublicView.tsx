import { Text as DsText } from '@/components/core/Typography';
import type { ReactNode } from 'react';
import {
  EntityDetailImage,
  EntityDetailLayout,
  EntityDetailSection,
} from '@/features/document-layout/ui/EntityDetailLayout';

interface ProgramEventSeriesPublicViewProps {
  title: string;
  description?: string | null;
  posterUrl?: string | null;
  controls?: ReactNode;
  eventsLabel: string;
  children: ReactNode;
}

export function ProgramEventSeriesPublicView({
  title,
  description,
  posterUrl,
  controls,
  eventsLabel,
  children,
}: ProgramEventSeriesPublicViewProps) {
  return (
    <EntityDetailLayout
      media={posterUrl ? <EntityDetailImage src={posterUrl} alt={title} /> : undefined}
      title={title}
      actions={controls}
      meta={
        description ? (
          <DsText size="sm" tone="secondary" wrap="preserve">
            {description}
          </DsText>
        ) : undefined
      }
    >
      <EntityDetailSection title={eventsLabel}>{children}</EntityDetailSection>
    </EntityDetailLayout>
  );
}
