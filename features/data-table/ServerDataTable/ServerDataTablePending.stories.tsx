import type { Meta, StoryObj } from '@storybook/nextjs';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/core/Button';
import { LayoutStack } from '@/components/core/Layout';
import { ServerDataTableContent } from './ServerDataTableContent';
import { ServerDataTableMultiFilter } from './ServerDataTableMultiFilterRuntime';
import { ServerDataTableMultiSort } from './ServerDataTableMultiSortRuntime';
import { ServerDataTablePaginationView } from './ServerDataTablePaginationView';
import { ServerDataTableNavigationProvider, ServerDataTablePendingProvider } from './ServerDataTableNavigation';

function TableNavigationPreview({ failed = false, keepRows = true }: { failed?: boolean; keepRows?: boolean }) {
  const finish = useRef<(() => void) | null>(null);
  const [waiting, setWaiting] = useState(false);
  useEffect(
    () => () => {
      finish.current?.();
    },
    [],
  );
  const navigate = () =>
    new Promise<void>((resolve) => {
      finish.current = resolve;
      setWaiting(true);
    });
  return (
    <LayoutStack>
      <Button
        disabled={!waiting}
        onClick={() => {
          finish.current?.();
          finish.current = null;
          setWaiting(false);
        }}
      >
        Finish navigation
      </Button>
      <ServerDataTableNavigationProvider
        value={{ pathname: '/preview', searchParams: new URLSearchParams(), push: navigate, refresh: navigate }}
      >
        <div data-datatable-root data-namespace="preview" data-accessible-label="Preview records">
          <ServerDataTablePendingProvider>
            <ServerDataTableMultiFilter
              namespace="preview"
              fields={[{ field: 'title', label: 'Title', type: 'string' }]}
            />
            <ServerDataTableMultiSort namespace="preview" fields={[{ field: 'title', label: 'Title' }]} />
            <ServerDataTableContent
              columns={[{ key: 'title', header: 'Title', accessor: 'title' }]}
              result={{
                data: [{ id: 'one', title: 'Notes' }],
                total: 8,
                page: 1,
                pageSize: 1,
                totalPages: 8,
                error: failed ? 'Could not load records' : undefined,
              }}
              getRowKey={(row) => row.id}
              showPendingLoader={!keepRows}
            />
            <ServerDataTablePaginationView
              currentPage={1}
              totalPages={8}
              getPageUrl={(page) => `/preview?page=${page}`}
              labels={{
                navigation: 'Preview pages',
                firstPage: 'First page',
                previousPage: 'Previous page',
                page: (page) => `Page ${page}`,
                nextPage: 'Next page',
                lastPage: 'Last page',
              }}
            />
          </ServerDataTablePendingProvider>
        </div>
      </ServerDataTableNavigationProvider>
    </LayoutStack>
  );
}
const meta: Meta<typeof TableNavigationPreview> = {
  title: 'Feature/Data Table/Server Navigation Wait',
  component: TableNavigationPreview,
  parameters: {
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Production table controllers and Core views. Navigate, apply a filter or sort, then use Finish navigation to settle the local transport promise. No server mutation runs.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof TableNavigationPreview>;
export const Default: Story = {};
export const ErrorRecovery: Story = { args: { failed: true } };
export const RetainedRows: Story = { args: { keepRows: true } };
