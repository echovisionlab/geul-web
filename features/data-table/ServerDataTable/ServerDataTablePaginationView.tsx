import { Pagination } from '@/components/core/Display';
import { LayoutInline as DsLayoutInline, LayoutInset as DsLayoutInset } from '@/components/core/Layout';

const PAGINATION_RESERVED_MIN_HEIGHT_PX = 36;

export interface ServerDataTablePaginationLabels {
  navigation?: string;
  firstPage: string;
  previousPage: string;
  page: (page: number) => string;
  nextPage: string;
  lastPage: string;
}

export interface ServerDataTablePaginationViewProps {
  onNavigate?: (href: string) => void;
  currentPage: number;
  totalPages: number;
  getPageUrl: (page: number) => string;
  labels: ServerDataTablePaginationLabels;
  reserveSpaceWhenHidden?: boolean;
}

/** URL-owned table pages through Core Pagination link mode; renders anchors from Server Components. */
export function ServerDataTablePaginationView({
  currentPage,
  onNavigate,
  totalPages,
  getPageUrl,
  labels: { navigation, ...labels },
  reserveSpaceWhenHidden = false,
}: ServerDataTablePaginationViewProps) {
  if (totalPages < 1) {
    return reserveSpaceWhenHidden ? (
      <DsLayoutInset blockStart="md" aria-hidden="true">
        <div style={{ minHeight: PAGINATION_RESERVED_MIN_HEIGHT_PX }} />
      </DsLayoutInset>
    ) : null;
  }

  return (
    <DsLayoutInset blockStart="md">
      <DsLayoutInline justify="center">
        <Pagination
          aria-label={navigation}
          value={currentPage}
          total={totalPages}
          getHref={getPageUrl}
          labels={labels}
          onNavigate={
            onNavigate
              ? (event) => {
                  event.preventDefault();
                  onNavigate(event.href);
                }
              : undefined
          }
        />
      </DsLayoutInline>
    </DsLayoutInset>
  );
}
