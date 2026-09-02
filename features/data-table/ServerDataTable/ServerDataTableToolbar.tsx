/**
 * Server DataTable Toolbar - Container for search, sort, filter controls.
 * Server Component compatible.
 */

import { DataTableToolbar, type DataTableToolbarProps } from '@/components/core/DataTable';

export type ServerDataTableToolbarProps = DataTableToolbarProps;

export function ServerDataTableToolbar({ children, justify = 'space-between' }: ServerDataTableToolbarProps) {
  return <DataTableToolbar justify={justify}>{children}</DataTableToolbar>;
}
