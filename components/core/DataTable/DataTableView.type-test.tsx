import { DataTableView, type DataTableViewProps } from './DataTableView';
const props: DataTableViewProps<string> = { columns: [], rows: [], getRowKey: (row) => row, emptyMessage: 'Empty' };
<DataTableView {...props} columnSizing="fixed" />;
<DataTableView {...props} columnSizing="content" />;
// @ts-expect-error Column sizing is a finite Core contract.
<DataTableView {...props} columnSizing="custom" />;
// @ts-expect-error Variable spreads cannot introduce unsupported sizing.
<DataTableView {...props} {...{ columnSizing: 'arbitrary' }} />;
// @ts-expect-error Consumers cannot replace Core table presentation.
<DataTableView {...props} style={{ tableLayout: 'fixed' }} />;

<DataTableView {...props} rowDividers="between" />;
// @ts-expect-error Header and body selection geometry share the Core middle alignment.
<DataTableView {...props} selectionCellVerticalAlign="top" />;
<DataTableView
  {...props}
  mobileLayout="inline"
  columns={[{ key: 'name', header: 'Name', renderCell: (row) => row, align: 'end', mobileVisibility: 'hidden' }]}
/>;
// @ts-expect-error Mobile layout is a finite Core contract.
<DataTableView {...props} mobileLayout="custom" />;
<DataTableView
  {...props}
  // @ts-expect-error Columns cannot introduce custom mobile visibility.
  columns={[{ key: 'name', header: 'Name', renderCell: (row) => row, mobileVisibility: 'custom' }]}
/>;
// @ts-expect-error Row divider policy is a finite Core contract.
<DataTableView {...props} rowDividers="custom" />;
