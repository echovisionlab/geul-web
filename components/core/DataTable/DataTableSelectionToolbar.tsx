import { Text } from '../Typography';
import { ToolbarLayout } from '../Section/ToolbarLayout';
import { LayoutInline as DsLayoutInline } from '../Layout';

import type { ReactNode } from 'react';

export interface DataTableSelectionToolbarProps {
  search: ReactNode;
  selectedCountLabel?: string | null;
  filters?: ReactNode;
  sorts?: ReactNode;
  actions?: ReactNode;
}

export function DataTableSelectionToolbar({
  search,
  selectedCountLabel,
  filters,
  sorts,
  actions,
}: DataTableSelectionToolbarProps) {
  return (
    <ToolbarLayout
      arrangement="actions-end"
      search={
        <DsLayoutInline gap="xs" wrap="wrap" flexible>
          {search}
          {selectedCountLabel ? (
            <Text size="xs" tone="secondary" truncate>
              {selectedCountLabel}
            </Text>
          ) : null}
        </DsLayoutInline>
      }
      filters={
        <DsLayoutInline gap="xxs" wrap="wrap">
          {filters}
          {sorts}
        </DsLayoutInline>
      }
      actions={actions}
    />
  );
}
