'use client';
import { SectionCard as DsSectionCard, SectionCard, StatCard } from '@/components/core/Section';
import Link from '@/components/core/Navigation';
import {
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
  LayoutContainer as DsLayoutContainer,
  LayoutInline as DsLayoutInline,
} from '@/components/core/Layout';
import { Text as DsText, Heading as DsHeading } from '@/components/core/Typography';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { PageLoader } from '@/features/site/PageLoader';
import { SiteLogo } from '@/features/site/SiteLogo';
import { FormAccessBoundary } from '@/features/form/FormAccessBoundary';
import { FieldStatsChart } from '@/features/form/FormDashboard/FieldStatsChart';
import { checkFormAccessAction, getFormDashboardByShareAction } from '@/lib/actions/form';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { resolveSiteHref } from '@/lib/utils/site-url';
interface FormDashboardViewProps {
  accessAction?: typeof checkFormAccessAction;
  dashboardAction?: typeof getFormDashboardByShareAction;
  slug: string;
  shareToken?: string;
  sharePassword?: string;
  requestedLocale: string;
}
export function FormDashboardView({
  slug,
  shareToken = '',
  sharePassword,
  requestedLocale,
  accessAction = checkFormAccessAction,
  dashboardAction = getFormDashboardByShareAction,
}: FormDashboardViewProps) {
  const t = useTranslations('formDashboardPage');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonTimeRanges = useTranslations('common.timeRanges');
  const tPublicForm = useTranslations('publicForm');
  const { settings } = useSiteSettings();
  const logoHref = resolveSiteHref(settings.site_origin);
  const accessQuery = useQuery({
    queryKey: ['form-dashboard-access', slug, shareToken, sharePassword, requestedLocale],
    queryFn: () =>
      accessAction({
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
      dashboardAction({
        slug,
        shareToken,
        sharePassword,
        requestedLocale,
      }).then(unwrapQueryResult),
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
      <div style={{ minHeight: '100dvh' }}>
        <DsLayoutStack>
          <DsLayoutStack align="center" justify="center" flexible>
            <DsText size="sm" tone="secondary">
              {t('states.invalidLink')}
            </DsText>
          </DsLayoutStack>
        </DsLayoutStack>
      </div>
    );
  }
  if (accessQuery.isLoading || (accessQuery.data?.accessible && dashboardQuery.isLoading)) {
    return (
      <div style={{ minHeight: '100dvh' }}>
        <DsSectionCard padding="none" appearance="surface" border="none">
          <DsLayoutInset space="none">
            <PageLoader />
          </DsLayoutInset>
        </DsSectionCard>
      </div>
    );
  }
  if (accessQuery.isError) {
    return <QueryErrorAlert queries={[accessQuery]} />;
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
  if (dashboardQuery.isError) {
    return <QueryErrorAlert queries={[dashboardQuery]} />;
  }
  const dashboard = dashboardQuery.data;
  if (!dashboard) {
    return <FormAccessBoundary reason="server_error" slug={slug} shareToken={shareToken} />;
  }
  return (
    <div style={{ minHeight: '100dvh' }}>
      <DsLayoutStack>
        <QueryErrorAlert queries={[dashboardQuery]} />
        <DsLayoutInset inline="xl" block="md">
          <DsLayoutInset space="none" as="header">
            <Link href={logoHref} appearance="graphic" aria-label={tPublicForm('logoLinkAria')}>
              <SiteLogo height={24} />
            </Link>
          </DsLayoutInset>
        </DsLayoutInset>

        <DsLayoutInset inline="xl" block="md">
          <DsLayoutInset space="none" as="main" flexible>
            <DsLayoutContainer size="wide">
              <DsSectionCard withBorder padding="xl">
                <DsLayoutStack gap="xl">
                  <div>
                    <DsHeading level={2} aria-level={1}>
                      {dashboard.formTitle}
                    </DsHeading>
                    <DsText size="sm" tone="secondary">
                      {tCommonLabels('dashboard')}
                    </DsText>
                  </div>

                  <DsLayoutInline>
                    <StatCard label={t('stats.total')} value={dashboard.totalSubmissions} grow />
                    <StatCard label={tCommonTimeRanges('today')} value={dashboard.submissionsToday} grow />
                    <StatCard label={tCommonTimeRanges('thisWeek')} value={dashboard.submissionsThisWeek} grow />
                    <StatCard label={tCommonTimeRanges('thisMonth')} value={dashboard.submissionsThisMonth} grow />
                  </DsLayoutInline>

                  {fieldStats.length > 0 && (
                    <DsLayoutStack gap="xl">
                      <DsHeading level={4} aria-level={2}>
                        {t('fieldStatistics')}
                      </DsHeading>
                      {fieldStats.map((fieldStat) => (
                        <SectionCard key={fieldStat.fieldId}>
                          <FieldStatsChart fieldStat={fieldStat} />
                        </SectionCard>
                      ))}
                    </DsLayoutStack>
                  )}
                </DsLayoutStack>
              </DsSectionCard>
            </DsLayoutContainer>
          </DsLayoutInset>
        </DsLayoutInset>
      </DsLayoutStack>
    </div>
  );
}
