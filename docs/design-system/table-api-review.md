# DataTable API and state review

2026-10-12. Draft code and DOM-event contract review, not design approval or an application-wide accessibility pass.
Existing Geul colors, density and mobile presentations remain. Changes concern click boundaries, sort semantics and keyboard access below.

## Carbon criteria and Geul decisions

| Criterion                                                                            | Geul application / retained behavior                                                                                                        |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Collection-wide actions belong to toolbar; individual actions belong to row controls | Distinguish Core DataTableToolbar/DataTableSelectionToolbar from kind='action' cells. Cell controls must not duplicate row activation       |
| Header selection is checked/unchecked/indeterminate; rows are checked/unchecked      | Header state uses selectable current-page rows, not selection across all data                                                               |
| Sort buttons and cell controls have normal keyboard behavior and names               | Retain native button/link/checkbox. One primary sort header carries aria-sort; hidden descriptions provide secondary order/direction        |
| Row menus remain discoverable on touch                                               | Preserve mobile action cells; no new hover-only menus                                                                                       |
| Carbon's 24/32/40/48/64px row scale and skeleton are Carbon choices                  | Preserve Geul's three padding-based densities and PageLoader. Carbon values and reserved-height estimates are not measured Geul row heights |

Sources: [Carbon Data table guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines),
[Carbon Data table accessibility](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/accessibility).
[WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/#aria-sort) specifies aria-sort on one header per table.
Geul has no Carbon expansion/radio-selection/dedicated batch-mode APIs. No features or palette were added.
The current bulk toolbar does not automatically lock row menus; do not describe it as Carbon batch-mode behavior.

## Public contract

Owners: [DataTableView.tsx](../../components/core/DataTable/DataTableView.tsx), [Display Table](../../components/core/Display/Display.tsx) and [selection.ts](../../components/core/DataTable/selection.ts).

| Area                    | Allowed API / defaults                                                                                                         | Usage                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data                    | columns, rows, getRowKey, emptyMessage required                                                                                | Stable unique row/column keys. renderCell(row) returns content/controls. Core does not fetch/filter/sort data                                                                                          |
| Naming / announcements  | accessibleLabel, resultMessage, loadingMessage                                                                                 | Same collection name reaches desktop table, scroll region and mobile collection. Do not merge announcement sentences into visible cells/names                                                          |
| Density / boundaries    | density='compact', rowDividers='all', highlightOnHover=false                                                                   | compact/standard/comfortable; all/between. Use between next to a footer to avoid duplicate final rules                                                                                                 |
| Mobile                  | mobileLayout='cards'                                                                                                           | cards/compact/inline. cards switches by viewport; compact/inline by component container below sm. Both DOM presentations are generated                                                                 |
| Column sizing           | columnSizing='content', desktopMinWidth=640                                                                                    | content/fixed. fixed includes numeric width/minWidth sums and a 44px selection track in minimum width; it does not delete long content                                                                 |
| Columns                 | key/header/renderCell; optional accessibleLabel/width/minWidth/kind/align/mobileVisibility/sort                                | kind=data/action, align=start/center/end. Empty image/action headers need accessibleLabel                                                                                                              |
| Hidden columns          | mobileVisibility=visible/hidden                                                                                                | Only inline secondary metadata; not a general desktop/cards/compact hiding API. Do not hide primary/leading/action content                                                                             |
| Sorting                 | sort.ariaLabel/description/direction/order/showOrder/disabled/onToggle                                                         | asc/desc; display and request intent only. Lowest positive active order is primary; without order, first active column. Localized descriptions convey secondary order/direction                        |
| Row activation          | rowAction.onActivate/getAccessibleLabel; optional getHref                                                                      | Native link with href, otherwise button. Return a real navigation URL; distinguish cell controls                                                                                                       |
| Selection               | selection.selectedRowKeys/onSelectedRowKeysChange/selectAllRowsLabel; optional getRowLabel/isRowSelectable/onRowSelectionClick | Controlled keys; caller names individual/select-all checkboxes. Caller callbacks own Shift-range policy                                                                                                |
| Additional row behavior | rowInteraction.isSelected/isDisabled/isDimmed/preventTextSelection/onClick/onDoubleClick/onContextMenu/onKeyDown               | FileManager/Picker selection/open/context policies; no arbitrary visual overrides for selected state                                                                                                   |
| Async / reservation     | loading/loadingContent/reservedRowCount/rootRef                                                                                | loading replaces body. Positive finite count is ceiled, then reserves 44 + 60 × count px; unspecified loading minimum is 240px. This estimate is not measured row height across densities/long content |

status, error, arbitrary style/className, expansion, pagination and footer props are not DataTableView APIs.
Feature Alert owns errors; separate compositions own pagination/footer.
Allowed/rejected API evidence: [DataTableView.type-test.tsx](../../components/core/DataTable/DataTableView.type-test.tsx).

## Click, keyboard and selection policy

Row-background clicks call rowInteraction.onClick first, then rowAction.onActivate unless canceled. Background modifier clicks retain this existing contract.
Native row links retain Ctrl/Meta/Shift/Alt and canceled-click URL intent without duplicate onActivate.
Checkbox/action cells stop propagation. Clicks inside custom native/ARIA controls or contenteditable do not activate the row.

Mobile rowInteraction rows are groups named by primary content. Their main command is a separate native button/link, with checkbox/menu outside that command. The group itself is not tabbable.
With rowAction, the existing native command is reused; with rowInteraction alone, a hidden button before primary content directly receives caller click/key handlers. This retains FileManager/Picker target===currentTarget key guards.
Its focus-visible state uses the existing [rowWithAction rule](../../components/core/DataTable/DataTableView.module.css) to outline the row. No visible labels were added. Actual browser focus/reading order remains a review item.

FileManager selects with modifier click/Space and opens with Enter. Picker distinguishes folder selection/opening and file selection/immediate confirmation using allowMultiple. Core does not change these domain policies. Table is not an arrow-key spreadsheet grid.

DataTableView select-all changes only selectable current-page keys and retains external-page keys.
[useCurrentPageRowSelection](../../components/core/DataTable/selection.ts) instead removes keys absent from rows; client/server bulk sections using it have page-scoped selection. Callers such as FileManager own persistent selection.
Checkbox checked uses selection keys; row highlight uses rowInteraction.isSelected. These are not automatically identical.
Disabled rows remain visible but block callbacks/checkboxes. Nonselectable folders remain navigable without checkboxes.

## Changes and verification evidence

- Reproduced and fixed contenteditable/combobox/switch cell clicks activating rows.
- Fixed mobile plain-cell activation blocked by the row's own role=button when rowInteraction and rowAction were combined.
- Made the actual horizontal-scroll wrapper tabbable; an existing collection name also names its region.
- Reproduced and fixed multiple aria-sort headers. Existing translated directions now reach hidden descriptions through the [view-model](../../features/data-table/content-view-model.ts) and client/server adapters.
- Replaced mobile button wrappers that obscured descendant controls with named groups and separate commands in all three layouts; checked event contracts.

Evidence: [Core view tests](../../components/core/DataTable/DataTableView.test.tsx),
[client content tests](../../features/data-table/DataTableContent.test.tsx),
[server content tests](../../features/data-table/ServerDataTable/ServerDataTableContent.test.tsx),
[selection tests](../../components/core/DataTable/selection.test.tsx),
[FileManager tests](../../features/file-manager/FileManagerView.test.tsx),
[Picker tests](../../features/editor/components/EditorFileLibraryPickerView.test.tsx).
Vitest verifies DOM/events, not actual Tab movement, native keyboard activation or AT reading.
The specified Core/adapters/bulk-selection/FileManager/Picker run passed 12 files / 91 tests. Core public typing and changed TS/TSX ESLint passed; colors/gaps/row heights received no visual approval.
The later full tsc --noEmit also failed. IconButton test overload issues were corrected; remaining diagnostics concern duplicate Next-generated .next/types/.next/dev/types and Storybook vendor types.
Full tsc was not rerun for that document update; do not record a full-app type pass.

Consumers: /admin/posts [PostsTableContent](../../features/admin/post/PostsTableContent.tsx), /admin/files and /files [FileManagerView](../../features/file-manager/FileManagerView.tsx), and [EditorFileLibraryPickerView](../../features/editor/components/EditorFileLibraryPickerView.tsx).
Comparison fixtures: [DataTableView stories](../../components/core/DataTable/DataTableView.stories.tsx), Populated/Empty/Loading/SelectableAndSortable/CompactList/InlineList/TruncatedNames/FooterBoundary.
Route/story presence is not evidence of browser success.

Current [Table.Tr](../../components/core/Display/Display.tsx) injects ToolbarDensityProvider='comfortable' without dragState. DataTableView density='compact' reduces cell padding independently of this inner control inheritance.
Measure cell padding, parent gap and inherited control height separately when reviewing table actions.

## Remaining checks

| Item                      | Required evidence / owner                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile / tablet / desktop | Actual Posts/FileManager/Picker at 320/390/834/1440px and around sm: cards viewport versus compact/inline container switching, long Korean/English names, visible actions and page overflow                   |
| Keyboard / AT             | Browser and actual AT evidence for scroll focus/horizontal movement, mobile main-trigger outline, checkbox → command → menu reading/Tab order, disabled/pending transitions and multi-sort direction/priority |
| Density / footer          | Display/Core measurements of three densities, long two-line rows, toolbar/action gap roles and one between/footer boundary                                                                                    |
| Caller data               | Runtime does not validate every duplicate/empty key, populated dataset without columns or missing checkbox/collection name; strengthen consumer specifications/fixtures                                       |
| Custom rendering          | Both desktop/mobile DOM are generated. Caller verifies no duplicate literal IDs or rendering side effects; Core does not normalize caller content                                                             |
| System adoption           | Update Core contract/Storybook/state examples, verify actual consuming screens and record adoption scope. Pending review is not design approval                                                               |
