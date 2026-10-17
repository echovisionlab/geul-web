# File browser contracts

This guide applies to the app File Manager and the editor File Library Picker. Core owns
geometry and appearance; the file-manager feature owns selection and navigation policy.
Neither consumer may add local tile widths, column CSS, checkbox styling or responsive overrides.

## Ownership and production adoption

| Responsibility                                                   | Definition                                                                                             | Consumers                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| File grid sizing, label truncation, highlight and keyboard focus | [Core SelectionSurface](../../components/core/SelectionSurface/SelectionSurface.tsx) and its owned CSS | Shared FileBrowserGridView in File Manager and Editor File Library Picker    |
| Parent navigation glyph and visibility                           | Core SelectionPath in SelectionSurface                                                                 | FileBrowserHeader and EditorFileLibraryPickerView                            |
| Common action hit area, glyph size and interaction states        | [Core IconButton](../../components/core/IconButton/IconButton.tsx) and Control.module.css              | Parent, grid, list, settings and management commands                         |
| Slider geometry, keyboard behavior and accessible step text      | [Core NativeRange](../../components/core/Input/NativeRange.tsx)                                        | Shared FileBrowserViewSettingsControl                                        |
| Type icons and compact list metadata                             | Core Display/FileTypeIcon and DataTableView inline rows                                                | Shared FileBrowserListView in both file browsers                             |
| Modifier selection and marquee policy                            | [useFileManagerSelection](../../features/file-manager/useFileManagerSelection.ts)                      | Both grid and list presentations                                             |
| Folder highlights versus submitted files                         | EditorFileLibraryPickerView's scoped folder selection and controlled selectedFiles                     | Single and multiple editor pickers; folders never enter the file form values |
| Consent-gated preference persistence                             | [useFileBrowserViewSettings](../../features/file-manager/useFileBrowserViewSettings.ts)                | FileManager and EditorFileLibraryPicker controllers                          |

Selection and keyboard focus are distinct states. The single selected-cell background indicates
selection; Core's focus outline appears for keyboard focus. Do not add another filename badge,
checkbox overlay, focus border or padding layer in a consumer.

The live component and story index is [generated-inventory.md](./generated-inventory.md);
production usage is recorded in [component-inventory.md](./component-inventory.md). These indexes
are regenerated from imports and story exports, not maintained as manual claims.

## Grid sizing

Use `SelectionViewport` as the available-width container and `SelectionGrid` for the grid.
`SelectionGrid.columns` reuses Core Layout's finite column count (1–12) and named responsive
breakpoints (`base`, `xs`, `sm`, `md`, `lg`, `xl`), with `auto` as the default.
Responsive values inherit forward and measure the enclosing viewport container, including
narrow dialogs on large screens. Unknown values and breakpoints are rejected at runtime.

```tsx
<SelectionViewport inset="sm">
  <SelectionGrid density="workspace" columns="auto">
    {/* SelectionSurface items */}
  </SelectionGrid>
</SelectionViewport>

<SelectionViewport inset="sm">
  <SelectionGrid density="workspace" columns={{ base: 3, sm: 6, lg: 'auto' }}>
    {/* SelectionSurface items */}
  </SelectionGrid>
</SelectionViewport>
```

An explicit count uses `repeat(N, minmax(0, 1fr))`: each column receives an equal fraction of
available width after gaps, `(width - (N - 1) * gap) / N`. Long names cannot force wider tracks.
Auto mode uses `repeat(auto-fill, minmax(min(100%, minimum), 1fr))`. The minimum determines
how many columns fit; it is not a fixed tile width or maximum. The remaining space is shared
by all columns. `auto-fill` keeps the last row aligned with preceding rows and prevents a
single remaining file from expanding across the surface. Empty tracks in a sparse final row
are intentional; residual space after a full row is not.

File browsers use `SelectionSurface.appearance="file"`, rather than the large square media-tile
presentation. Fractional **cell width** and **icon/thumbnail size** are separate contracts.
`iconSize` is `small | medium | large` on both the grid and surface: 1.5rem, 2rem and 3rem
preview bounds. Images stay inside that same bound; a wide cell never produces a giant icon
or square placeholder. The file label stays on one line and uses trailing ellipsis when it exceeds its track, without a grid checkbox. Do not split names into artificial filename fragments. The complete name remains available through the accessible label and title. Selection uses one cell background with ordinary text; there is no separate label badge. File surfaces use one xxs inset and xxs icon-to-label gap. The preview reserves only its icon height. SelectionViewport follows content height, without a fixed blank region.
The existing `tile` appearance remains available for media collections.

The grid's automatic minimum is 4.75rem for small icons, the density minimum for medium icons
(workspace: 6rem, 4.75rem in narrow containers), and 7.5rem for large icons. `spacing` is
`compact | standard | comfortable`, using shared xs/sm/lg spacing tokens. These are our
finite design-system decisions, not pixel values prescribed by Apple. Touch scrolling stays
native. Fixed counts should use responsive values when the same surface must support phones;
a user-selected explicit count intentionally overrides automatic fitting. None of these contracts
accepts local CSS, numeric icon sizes or arbitrary gaps.

The CSS behavior follows the [W3C CSS Grid flexible track specification](https://www.w3.org/TR/css-grid-2/#fr-unit)
and [automatic repeat rules](https://www.w3.org/TR/css-grid-2/#auto-repeat).

## Common toolbar

File browsers use the same Core [ToolbarLayout](../../components/core/Section/ToolbarLayout.tsx) as client/server DataTable controls through the SelectionToolbar adapter. Core owns container reflow, compact action and search/filter density, slot alignment and content insets. SelectionSurface keeps path/grid/row geometry only; it no longer owns a separate toolbar stylesheet. See [tables-and-toolbars.md](./tables-and-toolbars.md).

## Shared content inset

Both browser Views consume the shared sm→md Core LayoutInset for the visible toolbar and selection
viewport. Header toolbar layout uses no second inset; grid and list do not add independent
padding. This keeps the same inline edges in narrow containers as well as narrow viewports.
`Pages / Admin / File Manager / Inset Alignment` compares the actual edges and retains selection
through grid→list→grid changes. Item preview size and arrangement still belong to the grid owner.

## Search scope and continuation

The editor picker displays two compact Core xs TextButtons for all files and the current folder.
The named group retains the search-scope label without repeating a separate bold “Search:” row.
Each command keeps its visible scope in its accessible name; the folder command also identifies
the current folder. `aria-pressed` and Core's selected state indicate the active scope. Changing
scope restarts the actual controller query while preserving multiple file selections. Type and
sort controls retain their existing named Core contract.

Search uses `searchFileManagerItemsAction`: the default request size is 50; explicit sizes are
clamped to 1–100. The opaque returned `nextPageToken` owns continuation. Both production
controllers pass that cursor to Core NearEndLoader and await the next query. Browsing a folder
uses `listFileManagerItemsAction` with a 10,000-item complete-directory limit and no incremental
pagination; a truncated, duplicate or incomplete directory response is rejected by the action.
These are current action limits, not a claim about an unbounded backend catalog.

NearEndLoader observes a 240px prefetch margin around the closest scrolling ancestor. An explicit
scroll-root ref takes priority; an unbounded surface uses the document viewport. Each cursor is
attempted automatically once per `resetKey`. The owner supplies an awaited `onLoad`, next cursor
or `null`, localized load/loading/end/retry/failure labels and pending/error state. A compact
TextButton is exposed when observation fails or is unavailable; during automatic operation it
appears on keyboard focus. Pending keeps that command and its focus with `aria-disabled` and
announces one status. Failure retains existing results and exposes an explicit retry. Automatic
failure retry loops are blocked. A null cursor announces the end and removes the continuation
command after it loses focus; a focused continuation remains unavailable until the user moves
on so the final response does not drop keyboard focus. The loader does not own server state or
manufacture a cursor.

FileManager and EditorFileLibraryPicker guard simultaneous requests synchronously, reset pending
state when the query context changes, and ignore responses from an obsolete request generation.
Appending pages deduplicates overlapping kind/id pairs without clearing selection. A non-advancing
cursor is treated as a bounded load failure. Pagination pauses while input differs from the
debounced query. The editor's Paginated Search Results story uses local delayed pages; its
Loading More Search Results story is a controlled pending state. Neither performs an authenticated
service request. Controller tests separately exercise the actual transport callback and cursor.

## Reference and view settings

[Apple's Finder guide](https://support.apple.com/en-za/guide/mac-help/-mchldaafb302/mac)
describes separate icon-size and grid-spacing settings in View Options.
[Apple's iPhone Files guide](https://support.apple.com/en-ie/guide/iphone/iphc61044c11/ios)
places icon/list view changes with file-browser controls. We adopt their separation of preview
size, arrangement and selection behavior, while retaining our Core controls and theme tokens.
Apple's public guides do not provide exact responsive Files pixel measurements; do not present
our values as an Apple specification.

`FileBrowserViewToggle` renders grid/list as a Core SegmentedControl with icon options (a named radiogroup) and places a labelled adjustments button next to it.
It opens the shared `FileBrowserViewSettingsControl` popover. Local settings use Core Popover `size="compact"` (15rem/240px, viewport capped) and `padding="compact"` (xs). The composition uses xxs gaps, an h6 heading, xs label/value pairs and an xs Reset action aligned to the end. NativeRange retains its normal 30px interaction height; reduce surrounding whitespace rather than shrinking slider targets. This dense layout is shared by both file browser consumers. All fields use Core `NativeRange` sliders with the current value beside the label: icon size (small/medium/large, using the Core preview bounds), item spacing (compact/standard/comfortable), and columns (0 means automatic; 1–12 means an explicit count). `valueText` supplies localized step names to assistive technology. Arrow keys change one step, Home/End reach the endpoints, and pointer/touch movement updates the view immediately. Grid-specific controls are disabled in
list view. Changes apply immediately; Reset restores the appearance defaults while preserving
the current view. Escape and outside click close the panel and focus returns to its trigger.
The popover dialog is named by its heading, and all labels exist in every supported locale.

Both `FileManager` and `EditorFileLibraryPicker` consume `useFileBrowserViewSettings`.
The versioned `geul.file-browser.view.v1` local-storage entry contains only view mode, icon size,
spacing and column count. It never stores files, selected IDs, paths or search queries.
The current cookie consent schema exposes essential and analytics choices, with no preferences
category. To honor the requested consent gate conservatively, persistence requires current
analytics-enabled consent (the existing analytics-true flag, saved by the current consent UI). This is an acceptance signal for this
implementation, not a claim that display preferences are analytics. Without acceptance, settings
remain in the active session. Acceptance stores current settings; revocation or obsolete consent
removes stored preferences and the old unconditional `geul.file-manager.view` entry. Old view
mode is migrated only after valid acceptance. Corrupt/unknown versions and unavailable storage
fall back safely. Changes synchronize across mounted browsers and accepted browser tabs.
Storybook's controlled presentation stories remain deterministic and do not modify consent.

## Selection and confirmation

| Context              | Controls                                 | Activation                           | Confirmation                     |
| -------------------- | ---------------------------------------- | ------------------------------------ | -------------------------------- |
| Single file picker   | No checkboxes                            | Eligible file click or Enter/Space   | Immediately returns one file     |
| Multiple file picker | List checkboxes / grid highlight and Add | Selects files; double click previews | Add returns all selected files   |
| File Manager         | Highlight and list checkboxes            | Selects items; double click opens    | Domain actions consume selection |

`useFileManagerSelection` is shared by grid and list. Ordinary item clicks replace selection,
Ctrl/Cmd toggles one item, Shift selects a range from the anchor, and Ctrl/Cmd+Shift adds a range.
List checkboxes toggle individually; Shift-click uses the same range policy. File grids use Finder-style highlights without checkboxes or selected checkmark badges. Desktop marquee begins
in empty space. Ctrl/Cmd/Shift marquee keeps prior selections. Interactive controls and touch
scroll gestures never start marquee selection. In multiple selection contexts, touch taps toggle eligible files so mobile users can choose several files without a modifier key. Folders participate in browser highlight selection, including range and marquee, but never become file form values. Incompatible files remain excluded. The picker keeps folder selection scoped to the current location/query and retains file selection across folders. Click/Space selects a folder; double click/Enter opens it in both grid and list. Add is enabled only for eligible selected files. List checkbox selection remains file-only. Selections across
folders remain available for Add; an ordinary file click still replaces them.

Selection eligibility is separate from preview availability. An ineligible picker file is never
added by click, Space, range selection, marquee or Add, but Enter, double click and its context
menu can still open preview. Core `SelectionSurface.selectionUnavailable` requires a localized
`selectionUnavailableDescription`, keeps the row enabled and forbids `selected=true`.
The picker maps eligibility to this state rather than whole-row `unavailable`/`aria-disabled`.
Use `unavailable` only when every item action is unavailable. Selection-only constraints use
the existing muted text role rather than reducing the opacity of readable names and available actions.
The list supplies the same message through `DataTableView.rowInteraction.getDescription` for
desktop rows and mobile commands. Descriptions supplement the file name; they do not replace it.

The Core `selectionControl` slot owns checkbox placement. Table header and body use the same flex wrapper to remove inline baseline offsets; inline mobile controls and all content share the same vertical center. File lists consume Core `DataTableView.columnSizing="fixed"`: short trailing metadata tracks retain their widths, and the primary name track fills the remaining space. Both consumers use the same FileBrowserListView composition; do not duplicate columns or name/icon layouts. Long names stay on one line with trailing ellipsis in desktop and mobile lists, retaining the full DOM text and title. `DataTableView` exposes
`selection.onRowSelectionClick` for modifier-aware range policy. Selection changes never
submit or show an alert. Storybook form adapters show selected and added files only on Add,
then show submitted files and actual `FormData` file IDs on Submit. Only SingleSelectionForm and MultipleSelectionForm include the surrounding form harness; Browser and AccessibleRoot show the browser itself. The form is a Storybook integration example, not part of the browser component.

## Navigation and authorization

`SelectionPath pageTitle` renders the current location as the page's h1 (Heading scale 3 below `sm`, 2 above) for a browser that is the whole page; the admin file manager uses it, the editor library picker keeps the compact location. `SelectionPath.items[0]` is the accessible root. Only reachable ancestors belong in the supplied
path. `parentLabel` enables the up action below that root; it is absent at the root. Never render
a disabled parent action or reveal ancestors outside an authorized scope. Below the Core `sm` viewport or toolbar-container breakpoint, SelectionPath displays only the current folder name and the authorized parent button; ancestor names and separators are hidden. The current name receives the remaining width and uses trailing ellipsis if necessary. The full authorized path remains in the navigation title. Wider surfaces retain clickable authorized breadcrumbs. This is a Core path rule shared by both browsers, not a mobile consumer override. The parent action uses the curved `IconCornerLeftUp` glyph and the same default Core IconButton hit area, density and glyph size as the grid/list/settings actions. Do not assign a larger size to the parent action.

The current backend exposes a shared logical folder tree. `ListFileManagerItems` requires
`File.List` (author); folder creation, rename, move and deletion require `File.ManageLibrary`
(admin). The current protocol does not expose per-folder ACLs or a role-specific root. API
metadata must define any future restricted root; do not infer permissions from names, uploader,
MIME type or lack of a download URL. The scoped-root story demonstrates the presentation
contract without claiming that the current backend implements folder-specific permissions.

## Icons and compact lists

Use `Display/FileTypeIcon` with `inline`, `compact` or `preview` sizes. Folder/file icons belong
to the same name cell. Type labels are lowercase; folders have no size value or placeholder.
Both file browsers consume [FileBrowserListView](../../features/file-manager/ui/FileBrowserListView.tsx), backed by Core `DataTableView.mobileLayout="inline"`, `columnSizing="fixed"` and `density="compact"`. Every row is one line at every width: selection slot → inline icon → flexible filename → short format → size. Icons and checkboxes share the row's vertical center; unavailable/folder checkbox slots stay reserved so names align. Name text uses trailing ellipsis, retaining the full name in its title and accessible selection label. There is no metadata line under the filename.

At container widths below Core's `sm` breakpoint, the format and search location are omitted through `column.mobileVisibility="hidden"`; size remains at the trailing edge. Wider rows show lowercase extensions (`wav`, `png`, `pdf`) instead of MIME strings. Full MIME remains in the format title and preview/details. The format and size tracks are 64px and 80px; their xs text is secondary and aligned to the end. The primary track has no fixed minimum, so it receives the remaining width and truncates instead of forcing horizontal scrolling. Folders have no size or placeholder. A shared capacity formatter uses B/KB/MB/GB/TB with at most one fractional digit so large files do not produce long MB values. Search location, when needed, occupies a separate desktop track and is never stacked below the name.

Core owns inline row flex geometry, selection slots, min-height, padding, rules and responsive switching. Compact inline rows use existing xxs block padding, xs gaps/insets and the sm control minimum. Desktop table cells use the same compact table tokens. No new tokens, feature CSS or viewport-specific row copies are permitted. Card and two-line compact layouts remain separate generic DataTable contracts for other domains; file consumers always use inline. File Manager's upload time, uploader and usage details remain in the detail view; its default list uses this same file-name/format/size contract. List insets do not add an extra top gap.

## Verification

Inspect Core / Selection Surface / Contracts / File Icons and Grid Columns (automatic, fixed and responsive controls in one story). These grid examples use the file appearance; States retains the generic tile example. Folder Navigation compares the parent action with the grid/list actions and also shows an accessible root without an up action.
Inspect Core / Input / Native Range / States for automatic, explicit and disabled slider steps. Inspect Core / Display / File Type Icon and Core / Data Display / DataTableView / States / Inline List.
The editor's Multiple Selection Form, Single Selection Form, Accessible Root and Browser stories exercise production views with local state and no API mutation.

Check phone, tablet and desktop widths, light/dark themes and locale changes. Verify equal
computed column widths and no horizontal overflow; test sparse rows and long file names.
Exercise view settings, Reset, Escape/outside dismissal, consent acceptance/revocation, normal/modifier clicks, Shift checkboxes, marquee, touch scrolling, folder round trips,
Add and Submit. Run Core contract typing, Storybook typing, relevant component tests, CSS/TS
lint, and `scripts/design-system/validate.mjs`; refresh deterministic inventories when contracts
or stories change. Passing static checks does not replace visual and interaction verification.

## Boundary composition

File pickers use one divider per boundary. The inset toolbar uses `divider="none"`: control underlines and the table header divider already establish hierarchy. The table uses `rowDividers="between"` so the status footer owns the final boundary. `SelectionStatus divider="content"` aligns its rule with the responsive list inset (`sm` below the `sm` breakpoint, `md` above it) and the grid viewport. Do not stack a final table rule with a footer rule or draw a wider outer rule beside inset row dividers. Standalone tables retain their final rule by default. File Manager retains the final table rule and uses its status bar with `divider="none"`, so an extra outer rule cannot duplicate the table boundary. Its header and status share the responsive content insets, and its main stack uses the shared sm gap.

## Storybook ownership and deduplication

| Purpose                                   | Canonical story                                                                       | Coverage within that story                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| File browser layout/settings              | Editor File Library Picker / Browser                                                  | Grid/list toggle, density sliders, column settings, folder navigation; no extra form                                                      |
| Multiple file selection + form submission | Editor File Library Picker / Multiple Selection Form                                  | Checkbox/range/marquee selection, Add, actual FormData IDs and Submit report; both views                                                  |
| Single file selection + form submission   | Editor File Library Picker / Single Selection Form                                    | Immediate confirmation without checkboxes/Add, one form value and Submit report; both views                                               |
| Search/data states                        | Search Results, Paginated Search Results, Loading More Search Results, Loading, Empty | One story per distinct data/loading state; toggle views instead of duplicating lists                                                      |
| Authorized root                           | Accessible Root                                                                       | No inaccessible parent navigation                                                                                                         |
| File management                           | Pages / Admin / File Manager / Browser                                                | Grid/list/settings, selection and management actions; author permissions, detail, loading/empty/error remain separate states              |
| Local file input                          | Core / Input / FileInput                                                              | Single, multiple, accepted types, error and disabled contracts                                                                            |
| Local dropzone                            | Core / Input / FileDropzone                                                           | One multiple-selection story for keyboard, pointer and drag/drop; disabled and selection limits have distinct stories and result readouts |
| Grid geometry                             | Core / Selection Surface / Grid Columns                                               | Automatic/fixed/responsive modes through controls                                                                                         |
| Editor insertion and download policy      | File Insertion / Local Files; Media Download / Access Policy                          | Separate domain workflows, not copies of the library selector                                                                             |

Use the global viewport toolbar for phone/tablet QA rather than creating identical phone exports. Only the two form stories render the extra form. Add reports `selected` and `added`; Submit reports `selected`, `submitted` and real `fileIds`. Single-file confirmation updates the story's controlled selection before submission so the report remains coherent.
