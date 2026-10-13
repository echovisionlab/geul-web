'use client';
import { useTranslations } from 'next-intl';
import { buildPaginationUrl } from '@/lib/utils/table-url';
import type { ServerDataTablePaginationProps } from './ServerDataTablePagination';
import { ServerDataTablePaginationView } from './ServerDataTablePaginationView';
import { useEmbeddedServerTableNavigation } from './ServerDataTableNavigation';
/** Client boundary for the same pagination view when a complete page view is embedded. */
export function ServerDataTablePaginationClient({
  namespace,
  result,
  searchParams,
  basePath = '',
  reserveSpaceWhenHidden = false,
}: ServerDataTablePaginationProps) {
  const t = useTranslations('dataTable.pagination');
  const navigation = useEmbeddedServerTableNavigation();
  if (result.error) {
    return null;
  }
  return (
    <ServerDataTablePaginationView
      currentPage={result.page}
      totalPages={result.totalPages}
      getPageUrl={(page) => buildPaginationUrl(namespace, searchParams, page, basePath)}
      labels={{
        navigation: t('navigation'),
        firstPage: t('firstPage'),
        previousPage: t('previousPage'),
        page: (page) => t('page', { page }),
        nextPage: t('nextPage'),
        lastPage: t('lastPage'),
      }}
      reserveSpaceWhenHidden={reserveSpaceWhenHidden}
      onNavigate={navigation?.push}
    />
  );
}
