'use client';

import { IconFolder } from '@tabler/icons-react';
import { DataTableView, type DataTableViewProps, type DataTableViewSortState } from '@/components/core/DataTable';
import { FileTypeIcon } from '@/components/core/Display/FileTypeIcon';
import { LayoutInline, LayoutStack } from '@/components/core/Layout';
import { SelectionThumbnail } from '@/components/core/SelectionSurface';
import { Text } from '@/components/core/Typography';
export interface FileBrowserListViewProps<T extends { kind: 'file' | 'folder'; mimeType?: string }> extends Omit<
  DataTableViewProps<T>,
  'columns' | 'density' | 'mobileLayout' | 'columnSizing' | 'desktopMinWidth'
> {
  labels: { name: string; type: string; size: string; location: string; folderType: string };
  getPresentation: (item: T) => { name: string; format: string; size?: string; location?: string };
  showLocation?: boolean;
  nameSort?: DataTableViewSortState;
  sizeSort?: DataTableViewSortState;
}

/** Both file browsers consume one compact row contract; geometry belongs to Core. */
export function FileBrowserListView<T extends { kind: 'file' | 'folder'; mimeType?: string }>({
  labels,
  getPresentation,
  showLocation = false,
  nameSort,
  sizeSort,
  ...props
}: FileBrowserListViewProps<T>) {
  return (
    <DataTableView
      {...props}
      columnSizing="fixed"
      density="compact"
      mobileLayout="inline"
      desktopMinWidth={0}
      columns={[
        {
          key: 'name',
          header: labels.name,
          sort: nameSort,
          renderCell: (item) => (
            <LayoutInline gap="xs" align="center" wrap="nowrap">
              <SelectionThumbnail
                size="inline"
                tone={item.kind === 'folder' ? 'neutral' : 'muted'}
                icon={
                  item.kind === 'folder' ? (
                    <IconFolder aria-hidden />
                  ) : (
                    <FileTypeIcon file={{ mimeType: item.mimeType ?? '' }} size="inline" />
                  )
                }
              />
              <LayoutStack gap="none" flexible>
                <Text size="sm" truncate title={getPresentation(item).name}>
                  {getPresentation(item).name}
                </Text>
              </LayoutStack>
            </LayoutInline>
          ),
        },
        ...(showLocation
          ? [
              {
                key: 'location',
                header: labels.location,
                width: 160,
                mobileVisibility: 'hidden' as const,
                renderCell: (item: T) => (
                  <Text size="xs" tone="secondary" truncate title={getPresentation(item).location}>
                    {getPresentation(item).location}
                  </Text>
                ),
              },
            ]
          : []),
        {
          key: 'type',
          header: labels.type,
          width: 64,
          align: 'end',
          mobileVisibility: 'hidden',
          renderCell: (item) => (
            <Text
              size="xs"
              tone="secondary"
              align="end"
              truncate
              title={item.kind === 'file' ? item.mimeType : undefined}
            >
              {getPresentation(item).format}
            </Text>
          ),
        },
        {
          key: 'size',
          header: labels.size,
          width: 80,
          align: 'end',
          sort: sizeSort,
          renderCell: (item) =>
            item.kind === 'folder' ? null : (
              <Text size="xs" tone="secondary" align="end" truncate>
                {getPresentation(item).size}
              </Text>
            ),
        },
      ]}
    />
  );
}
