import { DataTableView, type DataTableViewProps } from '../DataTable/DataTableView';
import {
  SelectionGrid,
  SelectionSurface,
  SelectionRow,
  SelectionViewport,
  SelectionPath,
  SelectionStatus,
  SelectionToolbar,
  SelectionThumbnail,
} from './SelectionSurface';
const valid = <SelectionSurface label="File" preview={null} selected density="workspace" />;
const grid = <SelectionGrid label="Files" columns={5} />;
const responsiveGrid = <SelectionGrid label="Files" columns={{ base: 3, sm: 6, lg: 'auto' }} />;
// @ts-expect-error Column counts reuse the finite Core Layout contract.
const invalidGridCount = <SelectionGrid label="Files" columns={13} />;
// @ts-expect-error Unknown breakpoints are not part of the Core responsive contract.
const invalidGridBreakpoint = <SelectionGrid label="Files" columns={{ phone: 2 }} />;
void [responsiveGrid, invalidGridCount, invalidGridBreakpoint];
// @ts-expect-error Public selectable surfaces reject local CSS.
const tile = <SelectionSurface label="File" preview={null} className="local" />;
// @ts-expect-error Row appearance uses finite owner states.
const row = <SelectionRow bg="blue" />;
const unsafe = { style: { padding: 12 } };
// @ts-expect-error Typed spreads cannot bypass inset ownership.
const spread = <SelectionViewport {...unsafe} />;
void [valid, grid, tile, row, spread];

const compactRow = (
  <SelectionRow density="compact" onAction={() => {}}>
    Menu
  </SelectionRow>
);
// @ts-expect-error Row density is a finite Core contract, not a free size.
const arbitraryDensity = <SelectionRow density="tiny" />;
void [compactRow, arbitraryDensity];

const checkboxGrid = <SelectionGrid label="Files" selectionStyle="checkbox" />;
// @ts-expect-error Selection presentation is a finite Core contract.
const invalidSelectionStyle = <SelectionGrid label="Files" selectionStyle="custom" />;
void [checkboxGrid, invalidSelectionStyle];

const compactTable = (
  <DataTableView columns={[]} rows={[]} getRowKey={() => ''} emptyMessage="Empty" mobileLayout="compact" />
);
// @ts-expect-error Mobile table layout is a finite Core contract.
const invalidTableLayout: DataTableViewProps<never>['mobileLayout'] = 'custom';
void [compactTable, invalidTableLayout];

const scopedPath = <SelectionPath items={[{ name: 'Library' }]} parentLabel="Back" onOpen={() => {}} />;
// @ts-expect-error Path appearance belongs to Core.
const customPath = <SelectionPath items={[]} onOpen={() => {}} style={{ padding: 12 }} />;
void [scopedPath, customPath];

const file = <SelectionSurface label="File" preview={null} appearance="file" iconSize="small" />;
const spacedGrid = <SelectionGrid label="Files" spacing="comfortable" iconSize="large" />;
// @ts-expect-error Icon sizes are finite, independent of the cell width.
const numericIconSize = <SelectionSurface label="File" preview={null} iconSize={64} />;
// @ts-expect-error Grid spacing belongs to Core.
const numericSpacing = <SelectionGrid label="Files" spacing={20} />;
// @ts-expect-error Appearance has two owned roles.
const arbitraryAppearance = <SelectionSurface label="File" preview={null} appearance="custom" />;
void [file, spacedGrid, numericIconSize, numericSpacing, arbitraryAppearance];

// @ts-expect-error Thumbnail fit is a finite Core contract.
const customFit = <SelectionThumbnail fit="stretch" />;
void customFit;

// @ts-expect-error File names use Core truncation, not a consumer formatter.
const customNameFormat = <SelectionSurface label="File" preview={null} nameFormat="filename" />;
void customNameFormat;

<SelectionStatus density="standard" divider="content">
  4 items
</SelectionStatus>;
// @ts-expect-error Divider insets cannot be arbitrary consumer widths.
<SelectionStatus divider="custom" />;

<SelectionToolbar bordered divider="none" location={null} search={null} filters={null} actions={null} />;
// @ts-expect-error Toolbar boundary presentation is a finite Core contract.
<SelectionToolbar divider="custom" location={null} search={null} filters={null} actions={null} />;

// @ts-expect-error Every selection list needs a persistent accessible name.
const unnamedGrid = <SelectionGrid />;
void unnamedGrid;

const actionableGrid = (
  <SelectionGrid label="Files" selectionStyle="grid">
    <SelectionSurface
      label="Recording"
      selectionStyle="grid"
      preview={null}
      actions={<button type="button">More</button>}
    />
  </SelectionGrid>
);
void actionableGrid;

const previewOnly = (
  <SelectionSurface
    label="Poster.png"
    preview={null}
    selectionUnavailable
    selectionUnavailableDescription="Cannot add this file. Enter previews it."
  />
);
// @ts-expect-error Selection eligibility requires an accessible explanation.
const unexplainedSelection = <SelectionSurface label="Poster.png" preview={null} selectionUnavailable />;
const contradictorySelection = (
  // @ts-expect-error An item that cannot be selected must not report selected=true.
  <SelectionSurface
    label="Poster.png"
    preview={null}
    selected
    selectionUnavailable
    selectionUnavailableDescription="Preview only"
  />
);
const contradictoryAvailability = (
  // @ts-expect-error Whole-control unavailable and selection-only eligibility are separate contracts.
  <SelectionSurface
    label="Poster.png"
    preview={null}
    unavailable
    selectionUnavailable
    selectionUnavailableDescription="Preview only"
  />
);
void [previewOnly, unexplainedSelection, contradictorySelection, contradictoryAvailability];

import { BlockSelectionTarget } from './BlockSelectionTarget';
<BlockSelectionTarget label="Code block" onFocus={() => {}} tabIndex={-1} />;
<BlockSelectionTarget label="Video" pointer="capture" onKeyDown={() => {}} />;
// @ts-expect-error A block selection target requires a name.
<BlockSelectionTarget />;
// @ts-expect-error Pointer behavior is a closed contract.
<BlockSelectionTarget label="Video" pointer="auto" />;
// @ts-expect-error The focus ring and target geometry are Core-owned.
<BlockSelectionTarget label="Video" className="local" />;
