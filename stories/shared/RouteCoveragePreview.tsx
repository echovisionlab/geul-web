import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { DataTableView } from '@/components/core/DataTable/DataTableView';
import { TextInput } from '@/components/core/Input';
import { StorybookLink } from './StorybookLink';

export interface RoutePreviewRecord {
  route: string;
  family: string;
  source: string;
  previews: Array<{ storyTitle: string; variant: string; scope: string; storyId: string }>;
}

export function filterRouteRecords(records: RoutePreviewRecord[], query: string) {
  const normalized = query.trim().toLowerCase();
  return records.filter((record) =>
    `${record.route} ${record.family} ${record.source}`.toLowerCase().includes(normalized),
  );
}

/** Loads a compact, generated static catalog asset, never an application API or route controller. */
export function RouteCoveragePreview({ initialRecords }: { initialRecords?: RoutePreviewRecord[] }) {
  const [records, setRecords] = useState<RoutePreviewRecord[]>(initialRecords ?? []);
  const [loading, setLoading] = useState(initialRecords === undefined);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(12);
  useEffect(() => {
    if (initialRecords !== undefined) {
      return;
    }
    const controller = new AbortController();
    fetch('/ui-kit-docs/design-system/ui-kit-route-index.json', { signal: controller.signal, credentials: 'omit' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Missing static route catalog');
        }
        return response.json();
      })
      .then((catalog: { schemaVersion: number; routes: RoutePreviewRecord[] }) => {
        if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.routes)) {
          throw new Error('Unsupported route catalog');
        }
        setRecords(catalog.routes);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [initialRecords]);
  const filtered = filterRouteRecords(records, query);
  const mappedCount = records.filter((record) => record.previews.length > 0).length;
  return (
    <DsLayoutStack gap="md" lang="en">
      <DsLayoutInline justify="between" align="end">
        <TextInput
          label="Find a page source"
          placeholder="Route, category, or source path"
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setLimit(12);
          }}
        />
        <DsText size="sm" role="status" aria-live="polite">
          {records.length} sources · {mappedCount} static view/section mappings · {filtered.length} matching
        </DsText>
      </DsLayoutInline>
      {error ? (
        <Alert tone="warning">
          The generated catalog asset is unavailable. Rebuild the inventory, then reload this story.
        </Alert>
      ) : null}
      <DataTableView
        accessibleLabel="Route source mappings"
        desktopMinWidth="100%"
        rows={filtered.slice(0, limit)}
        getRowKey={(row) => row.source}
        columns={[
          {
            key: 'route',
            header: 'Page source',
            renderCell: (row) => (
              <DsLayoutStack gap="none">
                <DsText size="sm" weight="strong">
                  {row.route}
                </DsText>
                <DsText size="xs" tone="secondary">
                  {row.family}
                </DsText>
              </DsLayoutStack>
            ),
          },
          {
            key: 'preview',
            header: 'View / section preview',
            renderCell: (row) =>
              row.previews.length ? (
                <DsLayoutStack gap="xs">
                  {row.previews.map((preview) => (
                    <DsLayoutStack key={preview.storyId} gap="none">
                      <StorybookLink href={`/?path=/story/${preview.storyId}`}>
                        {preview.storyTitle} · {preview.variant}
                      </StorybookLink>
                      <DsText size="xs" tone="secondary">
                        {preview.scope}
                      </DsText>
                    </DsLayoutStack>
                  ))}
                </DsLayoutStack>
              ) : (
                <DsText size="sm" tone="secondary">
                  No mapped page composition preview
                </DsText>
              ),
          },
        ]}
        emptyMessage={query ? 'No page sources match this search.' : 'No route catalog loaded.'}
        loading={loading}
        loadingContent={<DsText size="sm">Loading the static source catalog…</DsText>}
      />
      {filtered.length > limit ? (
        <Button tone="neutral" emphasis="medium" onClick={() => setLimit((value) => value + 12)}>
          Show 12 more sources
        </Button>
      ) : null}
      <DsText size="xs" tone="secondary">
        Source existence does not establish a served route. A preview mapping establishes the documented view/section
        only; route authorization, SSR and service behavior remain outside.
      </DsText>
    </DsLayoutStack>
  );
}
