import { TableRowMenu, type TableRowMenuItem, type TableRowMenuProps } from './TableRowMenu';

const asyncItem: TableRowMenuItem = {
  label: 'Unban',
  onClick: () => Promise.resolve({ updated: true }),
  onError: (error: unknown) => {
    void error;
  },
};
<TableRowMenu aria-label="Actions for Ada" items={[asyncItem, { label: 'Edit', href: '/edit' }]} />;
// @ts-expect-error The row menu trigger requires its established accessible name.
<TableRowMenu items={[asyncItem]} />;
// @ts-expect-error Promise results must be returned by an action, not passed as the handler.
const promiseHandler: TableRowMenuItem = { label: 'Unban', onClick: Promise.resolve() };
// @ts-expect-error Pending feedback does not expose feature-owned item styling.
const styledItem: TableRowMenuItem = { label: 'Unban', style: { color: 'red' } };
const override = { 'aria-label': 'Actions', items: [asyncItem], className: 'custom' };
// @ts-expect-error Typed spreads cannot bypass the Core menu's visual contract.
const styledMenu: TableRowMenuProps = override;
void [promiseHandler, styledItem, styledMenu];
