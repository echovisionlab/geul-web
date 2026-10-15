import { Popover } from './Popover';

<Popover.Dropdown role="dialog" aria-label="View settings">
  Settings
</Popover.Dropdown>;
<Popover.Dropdown role="alertdialog" aria-label="Notice">
  Notice
</Popover.Dropdown>;
// @ts-expect-error A command menu must use DropdownMenu, not a dialog surface.
<Popover.Dropdown role="menu">Commands</Popover.Dropdown>;
// @ts-expect-error Typed spreads cannot replace the actual dialog role.
<Popover.Dropdown {...{ role: 'group' as const }}>Details</Popover.Dropdown>;
