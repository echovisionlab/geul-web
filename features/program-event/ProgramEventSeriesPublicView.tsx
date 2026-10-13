import { Text as DsText } from '@/components/core/Typography';
import type { ReactNode } from 'react';

import { LayoutGrid, LayoutGridItem, LayoutStack } from '@/components/core/Layout';
import { PageHeader } from '@/components/core/PageHeader';

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
  const details = (
    <LayoutStack gap="md">
      <PageHeader title={title} actions={controls} />
      {description ? (
        <DsText size="sm" tone="secondary" wrap="preserve">
          {description}
        </DsText>
      ) : null}
    </LayoutStack>
  );

  return (
    <LayoutStack gap="lg">
      {posterUrl ? (
        <LayoutGrid columns={12} gap="xl" align="start">
          <LayoutGridItem span={{ base: 12, md: 7 }}>
            <img
              src={posterUrl}
              alt={title}
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                maxHeight: 'min(80dvh, 900px)',
                objectFit: 'contain',
              }}
            />
          </LayoutGridItem>
          <LayoutGridItem span={{ base: 12, md: 5 }}>{details}</LayoutGridItem>
        </LayoutGrid>
      ) : (
        details
      )}

      <LayoutStack gap="sm">
        <PageHeader title={eventsLabel} level={2} />
        {children}
      </LayoutStack>
    </LayoutStack>
  );
}
