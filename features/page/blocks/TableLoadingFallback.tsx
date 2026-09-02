import { Box } from '@mantine/core';
import { getReservedTableContentMinHeight } from '@/components/core/DataTable';
import { PageLoader } from '@/features/site/PageLoader';

interface TableLoadingFallbackProps {
  reservedRowCount?: number;
  message?: string;
}

export function TableLoadingFallback({ reservedRowCount, message }: TableLoadingFallbackProps) {
  const minHeight = getReservedTableContentMinHeight(reservedRowCount) ?? 200;

  return (
    <Box style={{ minHeight, position: 'relative' }}>
      <PageLoader minHeight={minHeight} message={message} />
    </Box>
  );
}
