import type { ReactNode } from 'react';
import { Box, Divider, Grid, GridCol, Stack, Text } from '@mantine/core';
import { PageHeader } from '@/components/core/PageHeader';

interface ProgramEventSeriesPublicViewProps {
  title: string;
  summary?: string | null;
  description?: string | null;
  posterUrl?: string | null;
  controls?: ReactNode;
  eventsLabel: string;
  children: ReactNode;
}

export function ProgramEventSeriesPublicView({
  title,
  summary,
  description,
  posterUrl,
  controls,
  eventsLabel,
  children,
}: ProgramEventSeriesPublicViewProps) {
  const details = (
    <Stack gap="md">
      <PageHeader title={title} actions={controls} />
      {summary ? <Text size="md">{summary}</Text> : null}
      {description ? (
        <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
          {description}
        </Text>
      ) : null}
    </Stack>
  );

  return (
    <Stack gap="lg">
      {posterUrl ? (
        <Grid gap="xl" align="start">
          <GridCol span={{ base: 12, md: 7 }}>
            <Box>
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
            </Box>
          </GridCol>
          <GridCol span={{ base: 12, md: 5 }}>{details}</GridCol>
        </Grid>
      ) : (
        details
      )}

      <Divider />
      <Stack gap="sm">
        <PageHeader title={eventsLabel} level={2} />
        {children}
      </Stack>
    </Stack>
  );
}
