import { LayoutInset as DsLayoutInset } from '@/components/core/Layout';

import { getReservedTableContentMinHeight } from '@/components/core/DataTable';
import { PageLoader } from '@/features/site/PageLoader';

interface TableLoadingFallbackProps {
  reservedRowCount?: number;
  message?: string;
}

export function TableLoadingFallback({ reservedRowCount, message }: TableLoadingFallbackProps) {
  const minHeight = getReservedTableContentMinHeight(reservedRowCount) ?? 200;

  return (
    <div style={{ minHeight, position: 'relative' }}>
      <DsLayoutInset space="none">
        <PageLoader extent="container" message={message} />
      </DsLayoutInset>
    </div>
  );
}
