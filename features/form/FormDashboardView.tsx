'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Center, Container, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { PageLoader } from '@/features/site/PageLoader';
import { SectionCard, StatCard } from '@/components/core/Section';
import { SiteLogo } from '@/features/site/SiteLogo';
import { FormAccessBoundary } from '@/features/form/FormAccessBoundary';
import { FieldStatsChart } from '@/features/form/FormDashboard/FieldStatsChart';
import { checkFormAccessAction, getFormDashboardByShareAction } from '@/lib/actions/form';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { resolveSiteHref } from '@/lib/utils/site-url';

interface FormDashboardViewProps {
  slug: string;
  shareToken?: string;
  sharePassword?: string;
  requestedLocale: string;
}

export function FormDashboardView({ slug, shareToken = '', sharePassword, requestedLocale }: FormDashboardViewProps) {
  const t = useTranslations('formDashboardPage');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonTimeRanges = useTranslations('common.timeRanges');
  const tPublicForm = useTranslations('publicForm');
  const { settings } = useSiteSettings();
  const logoHref = resolveSiteHref(settings.site_origin);

  const accessQuery = useQuery({
    queryKey: ['form-dashboard-access', slug, shareToken, sharePassword, requestedLocale],
    queryFn: () =>
      checkFormAccessAction({
        slug,
        context: 'url',
        shareToken,
        sharePassword,
        target: 'dashboard',
        requestedLocale,
      }),
    enabled: !!shareToken,
  });

  const dashboardQuery = useQuery({
    queryKey: ['form-dashboard-data', slug, shareToken, sharePassword, requestedLocale],
    queryFn: () =>
      getFormDashboardByShareAction({
        slug,
        shareToken,
        sharePassword,
        requestedLocale,
      }),
    enabled: !!shareToken && accessQuery.data?.accessible === true,
  });

  const fieldStats = useMemo(() => {
    if (!dashboardQuery.data?.fieldStats) {
      return [];
    }
    return Object.values(dashboardQuery.data.fieldStats).map((fieldStat) => ({
      fieldId: fieldStat.fieldId,
      fieldName: fieldStat.fieldLabel,
      fieldType: 'select' as const,
      distribution: fieldStat.values.map((v) => ({ value: v.value, count: v.count })),
    }));
  }, [dashboardQuery.data?.fieldStats]);

  if (!shareToken) {
    return (
      <Box style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <Center style={{ flex: 1 }}>
          <Text c="dimmed">{t('states.invalidLink')}</Text>
        </Center>
      </Box>
    );
  }

  if (accessQuery.isLoading || (accessQuery.data?.accessible && dashboardQuery.isLoading)) {
    return (
      <Box mih="100dvh" bg="var(--mantine-color-body)">
        <PageLoader />
      </Box>
    );
  }

  if (!accessQuery.data?.accessible) {
    const params = new URLSearchParams();
    params.set('next', 'dashboard');
    params.set('share', shareToken);
    if (requestedLocale) {
      params.set('lang', requestedLocale);
    }
    const passwordPath = `/forms/${slug}/password?${params.toString()}`;
    return (
      <FormAccessBoundary
        reason={accessQuery.data?.reason ?? 'server_error'}
        slug={slug}
        shareToken={shareToken}
        passwordPath={passwordPath}
      />
    );
  }

  const dashboard = dashboardQuery.data;
  if (!dashboard) {
    return <FormAccessBoundary reason="server_error" slug={slug} shareToken={shareToken} />;
  }

  return (
    <Box style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Box component="header" px="xl" py="md">
        <a href={logoHref} aria-label={tPublicForm('logoLinkAria')} style={{ display: 'inline-flex' }}>
          <SiteLogo height={24} />
        </a>
      </Box>

      <Box component="main" px="xl" py="md" style={{ flex: 1 }}>
        <Container size="xl">
          <Paper p="xl" withBorder>
            <Stack gap="xl">
              <div>
                <Title order={2}>{dashboard.formTitle}</Title>
                <Text size="sm" c="dimmed">
                  {tCommonLabels('dashboard')}
                </Text>
              </div>

              <Group>
                <StatCard label={t('stats.total')} value={dashboard.totalSubmissions} style={{ flex: 1 }} />
                <StatCard label={tCommonTimeRanges('today')} value={dashboard.submissionsToday} style={{ flex: 1 }} />
                <StatCard
                  label={tCommonTimeRanges('thisWeek')}
                  value={dashboard.submissionsThisWeek}
                  style={{ flex: 1 }}
                />
                <StatCard
                  label={tCommonTimeRanges('thisMonth')}
                  value={dashboard.submissionsThisMonth}
                  style={{ flex: 1 }}
                />
              </Group>

              {fieldStats.length > 0 && (
                <Stack gap="xl">
                  <Title order={4}>{t('fieldStatistics')}</Title>
                  {fieldStats.map((fieldStat) => (
                    <SectionCard key={fieldStat.fieldId}>
                      <FieldStatsChart fieldStat={fieldStat} />
                    </SectionCard>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}
